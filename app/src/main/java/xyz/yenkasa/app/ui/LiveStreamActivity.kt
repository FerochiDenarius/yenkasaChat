package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.SurfaceView
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import com.google.android.material.bottomsheet.BottomSheetDialog
import io.agora.rtc2.ChannelMediaOptions
import io.agora.rtc2.Constants
import io.agora.rtc2.IRtcEngineEventHandler
import io.agora.rtc2.RtcEngine
import io.agora.rtc2.video.VideoCanvas
import io.socket.client.Socket
import io.socket.emitter.Emitter
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AgoraLiveToken
import xyz.yenkasa.app.model.LiveGiftRequest
import xyz.yenkasa.app.model.LiveGiftResponse
import xyz.yenkasa.app.model.LiveGuest
import xyz.yenkasa.app.model.LiveStream
import xyz.yenkasa.app.model.LiveStreamResponse
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.AppLinkManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.yme.YmeAnalyticsManager
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

class LiveStreamActivity : AppCompatActivity() {
    private val tag = "LiveStreamActivity"

    private lateinit var videoContainer: FrameLayout
    private lateinit var reactionsLayer: FrameLayout
    private lateinit var titleText: TextView
    private lateinit var subtitleText: TextView
    private lateinit var viewerText: TextView
    private lateinit var timerText: TextView
    private lateinit var commentsContainer: LinearLayout
    private lateinit var commentInput: EditText
    private lateinit var sendButton: Button
    private lateinit var hostControls: View
    private lateinit var flipButton: ImageButton
    private lateinit var muteButton: ImageButton
    private lateinit var endButton: ImageButton
    private lateinit var reactionButton: ImageButton
    private lateinit var giftButton: ImageButton
    private lateinit var shareButton: ImageButton
    private lateinit var commentsButton: ImageButton
    private lateinit var reportButton: ImageButton
    private lateinit var buttonRequestSeat: ImageButton
    private lateinit var recyclerGuests: androidx.recyclerview.widget.RecyclerView

    private var rtcEngine: RtcEngine? = null
    private var localView: SurfaceView? = null
    private var remoteView: SurfaceView? = null
    private var guestAdapter: xyz.yenkasa.app.adapter.LiveGuestAdapter? = null
    private val activeGuests = mutableListOf<xyz.yenkasa.app.model.LiveGuest>()
    private var streamId: String = ""
    private var channelName: String = ""
    private var agoraToken: String = ""
    private var agoraAppId: String = ""
    private var agoraUid: Int = INVALID_AGORA_UID
    private var isHost: Boolean = false
    private var muted = false
    private var joinedSocketRoom = false
    private var hostReadyEmitted = false
    private var endRequestSent = false
    private var joinRetried = false
    private var tokenRefreshInFlight = false
    private var liveJoinAckPending = false
    private var liveJoinRetryCount = 0
    private var scheduledEndAtMillis: Long = 0L
    private var liveIdentityUsername: String = ""
    private var liveIdentityAvatar: String = ""
    private var lastReactionAt = 0L
    private val recentLiveEventKeys = linkedMapOf<String, Long>()
    private val liveJoinAckHandler = Handler(Looper.getMainLooper())
    private val liveJoinRetryRunnable = Runnable { handleLiveJoinAckTimeout() }
    private val liveSocketListeners = mutableMapOf<String, Emitter.Listener?>()
    private val timerHandler = Handler(Looper.getMainLooper())
    private val hostHeartbeatHandler = Handler(Looper.getMainLooper())
    private val hostHeartbeatRunnable = object : Runnable {
        override fun run() {
            emitHostHeartbeat()
            hostHeartbeatHandler.postDelayed(this, 15_000L)
        }
    }
    private val socketReconnectListener = Emitter.Listener {
        runOnUiThread {
            if (isHost && hostReadyEmitted) {
                emitHostReady(force = true)
            }
            if (!joinedSocketRoom || liveJoinAckPending) {
                emitLiveJoin(force = true)
            }
        }
    }
    private val timerRunnable = object : Runnable {
        override fun run() {
            updateTimer()
            if (scheduledEndAtMillis > 0L) timerHandler.postDelayed(this, 1_000L)
        }
    }
    private val agoraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val granted = hasAgoraPermissions()
        Log.i(
            tag,
            "Agora permission result. granted=$granted host=$isHost streamId=$streamId channel=$channelName result=$result"
        )
        if (granted) {
            initializeAgora()
        } else {
            Toast.makeText(this, agoraPermissionDeniedMessage(), Toast.LENGTH_LONG).show()
            if (isHost && !hostReadyEmitted) cancelStartingLive()
            finish()
        }
    }

    private val rtcHandler = object : IRtcEngineEventHandler() {
        override fun onUserJoined(uid: Int, elapsed: Int) {
            runOnUiThread { setupRemoteVideo(uid) }
        }

        override fun onUserOffline(uid: Int, reason: Int) {
            runOnUiThread {
                remoteView?.let { videoContainer.removeView(it) }
                remoteView = null
                addComment(getString(R.string.host_left_live))
            }
        }

        override fun onJoinChannelSuccess(channel: String?, uid: Int, elapsed: Int) {
            runOnUiThread {
                Log.i(
                    tag,
                    "Agora join success. streamId=$streamId channel=$channel uid=$uid expectedUid=$agoraUid elapsed=$elapsed host=$isHost"
                )
                if (uid != agoraUid) {
                    Log.e(
                        tag,
                        "Agora UID mismatch after join. streamId=$streamId channel=$channel expectedUid=$agoraUid joinedUid=$uid host=$isHost"
                    )
                    Toast.makeText(this@LiveStreamActivity, R.string.live_video_credentials_invalid, Toast.LENGTH_LONG).show()
                    if (isHost && !hostReadyEmitted) cancelStartingLive()
                    finish()
                    return@runOnUiThread
                }
                YmeAnalyticsManager.trackLiveStreamJoin(streamId = streamId)
                if (isHost) {
                    emitHostReady()
                    emitLiveJoin()
                } else {
                    emitLiveJoin()
                }
            }
        }

        override fun onError(err: Int) {
            runOnUiThread {
                val message = agoraUserMessage(err)
                Log.e(
                    tag,
                    "Agora error. streamId=$streamId channel=$channelName uid=$agoraUid error=$err message=$message host=$isHost"
                )
                if (shouldRefreshTokenForAgoraError(err)) {
                    refreshAgoraToken("agora_error_$err", retryJoinAfterRefresh = true)
                    return@runOnUiThread
                }
                if (!joinRetried) {
                    retryAgoraJoin("agora_error_$err")
                } else {
                    Toast.makeText(this@LiveStreamActivity, message, Toast.LENGTH_LONG).show()
                    if (isHost && !hostReadyEmitted) cancelStartingLive()
                    finish()
                }
            }
        }

        override fun onConnectionLost() {
            runOnUiThread {
                Log.w(tag, "Agora connection lost. streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
                Toast.makeText(
                    this@LiveStreamActivity,
                    R.string.live_connection_lost_retrying,
                    Toast.LENGTH_SHORT
                ).show()
                retryAgoraJoin("connection_lost")
            }
        }

        override fun onTokenPrivilegeWillExpire(token: String?) {
            Log.w(tag, "Agora token will expire soon. streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
            refreshAgoraToken("token_will_expire", retryJoinAfterRefresh = false)
        }

        override fun onRequestToken() {
            Log.w(tag, "Agora requested a fresh token. streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
            refreshAgoraToken("token_requested", retryJoinAfterRefresh = true)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_live_stream)

        readExtras()
        bindViews()
        applyInsets()
        bindActions()
        refreshLiveIdentity()
        setupSocket()
        ensureAgoraPermissionsThenStart()
    }

    private fun readExtras() {
        streamId = intent.getStringExtra(EXTRA_STREAM_ID).orEmpty()
        channelName = intent.getStringExtra(EXTRA_CHANNEL).orEmpty()
        agoraToken = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        agoraAppId = intent.getStringExtra(EXTRA_APP_ID).orEmpty()
        agoraUid = intent.getIntExtra(EXTRA_UID, INVALID_AGORA_UID)
        isHost = intent.getBooleanExtra(EXTRA_IS_HOST, false)
        activeGuests.clear()
        activeGuests.addAll(parseGuestsExtra(intent.getStringExtra(EXTRA_GUESTS)))
        Log.i(
            tag,
            "Live extras loaded. streamId=$streamId channel=$channelName tokenBlank=${agoraToken.isBlank()} appIdBlank=${agoraAppId.isBlank()} tokenUid=$agoraUid host=$isHost guests=${activeGuests.size}"
        )
    }

    private fun bindViews() {
        videoContainer = findViewById(R.id.liveVideoContainer)
        reactionsLayer = findViewById(R.id.liveReactionsLayer)
        titleText = findViewById(R.id.textLiveTitle)
        subtitleText = findViewById(R.id.textLiveSubtitle)
        viewerText = findViewById(R.id.textLiveViewers)
        timerText = findViewById(R.id.textLiveTimer)
        commentsContainer = findViewById(R.id.liveCommentsContainer)
        commentInput = findViewById(R.id.editLiveComment)
        sendButton = findViewById(R.id.buttonSendLiveComment)
        hostControls = findViewById(R.id.liveHostControls)
        flipButton = findViewById(R.id.buttonFlipCamera)
        muteButton = findViewById(R.id.buttonMuteLive)
        endButton = findViewById(R.id.buttonEndLive)
        reactionButton = findViewById(R.id.buttonLiveReaction)
        giftButton = findViewById(R.id.buttonLiveGift)
        shareButton = findViewById(R.id.buttonLiveShare)
        commentsButton = findViewById(R.id.buttonLiveComments)
        reportButton = findViewById(R.id.buttonLiveReport)
        buttonRequestSeat = findViewById(R.id.buttonRequestLiveSeat)
        recyclerGuests = findViewById(R.id.recyclerLiveGuests)

        guestAdapter = xyz.yenkasa.app.adapter.LiveGuestAdapter({ rtcEngine }, { agoraUid }, isHost) { guest, action ->
            handleGuestAction(guest, action)
        }
        recyclerGuests.layoutManager = androidx.recyclerview.widget.LinearLayoutManager(this, androidx.recyclerview.widget.LinearLayoutManager.HORIZONTAL, false)
        recyclerGuests.adapter = guestAdapter
        guestAdapter?.submitList(activeGuests.toList())

        val hostName = intent.getStringExtra(EXTRA_HOST).orEmpty()
        val liveTitle = intent.getStringExtra(EXTRA_TITLE).orEmpty()
        val community = intent.getStringExtra(EXTRA_COMMUNITY).orEmpty()
        titleText.text = hostName.ifBlank { getString(R.string.viewer_fallback) }
        subtitleText.text = if (community.isNotBlank()) {
            getString(R.string.live_title_with_community, liveTitle, community)
        } else {
            liveTitle.ifBlank { getString(R.string.live_from_yenkasa) }
        }
        hostControls.visibility = if (isHost) View.VISIBLE else View.GONE
        buttonRequestSeat.visibility = if (isHost) View.GONE else View.VISIBLE
        scheduledEndAtMillis = parseIsoMillis(intent.getStringExtra(EXTRA_SCHEDULED_END_AT))
        timerText.visibility = if (isHost && scheduledEndAtMillis > 0L) View.VISIBLE else View.GONE
        if (timerText.visibility == View.VISIBLE) {
            timerHandler.post(timerRunnable)
        }
    }

    private fun applyInsets() {
        val topBar = findViewById<View>(R.id.liveTopBar)
        val liveStatusPill = findViewById<View>(R.id.liveStatusPill)
        val composer = findViewById<View>(R.id.liveCommentComposer)
        val audienceActions = findViewById<View>(R.id.liveAudienceActions)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.liveRoot)) { _, insets ->
            val safeBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            val bottomInset = maxOf(safeBars.bottom, ime.bottom)
            topBar.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                topMargin = safeBars.top + dp(14)
                marginStart = safeBars.left + dp(18)
                marginEnd = safeBars.right + dp(18)
            }
            liveStatusPill.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                marginEnd = safeBars.right + dp(18)
            }
            composer.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                bottomMargin = bottomInset + dp(26)
                marginStart = safeBars.left + dp(18)
                marginEnd = safeBars.right + dp(18)
            }
            hostControls.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                bottomMargin = dp(18)
                marginEnd = safeBars.right + dp(18)
            }
            audienceActions.updateLayoutParams<androidx.constraintlayout.widget.ConstraintLayout.LayoutParams> {
                marginEnd = safeBars.right + dp(18)
            }
            insets
        }
        ViewCompat.requestApplyInsets(findViewById(R.id.liveRoot))
    }

    private fun bindActions() {
        findViewById<View>(R.id.buttonLiveBack).setOnClickListener { onBackPressed() }
        findViewById<View>(R.id.buttonLiveMore).setOnClickListener {
            Toast.makeText(this, R.string.more_options, Toast.LENGTH_SHORT).show()
        }
        sendButton.setOnClickListener { sendComment() }

        // Expanded click targets for the action rail
        findViewById<View>(R.id.containerLiveShare).setOnClickListener { shareLiveStream() }
        shareButton.setOnClickListener { shareLiveStream() }

        findViewById<View>(R.id.containerLiveComments).setOnClickListener { focusCommentInput() }
        commentsButton.setOnClickListener { focusCommentInput() }

        findViewById<View>(R.id.containerLiveReaction).setOnClickListener { sendReaction("❤️") }
        reactionButton.setOnClickListener { sendReaction("❤️") }
        reactionButton.setOnLongClickListener {
            sendReaction(listOf("❤️", "🔥", "😂").random())
            true
        }

        findViewById<View>(R.id.containerLiveGift).setOnClickListener { showGiftSheet() }
        giftButton.setOnClickListener { showGiftSheet() }

        findViewById<View>(R.id.containerLiveReport).setOnClickListener { showReportToast() }
        reportButton.setOnClickListener { showReportToast() }

        findViewById<View>(R.id.containerLiveRequestSeat).setOnClickListener { requestGuestSeat() }
        buttonRequestSeat.setOnClickListener { requestGuestSeat() }

        flipButton.setOnClickListener { rtcEngine?.switchCamera() }
        muteButton.setOnClickListener {
            muted = !muted
            rtcEngine?.muteLocalAudioStream(muted)
            muteButton.setImageResource(if (muted) R.drawable.ic_volume_off else R.drawable.ic_volume_up)
        }
        endButton.setOnClickListener { endLiveAndFinish() }
    }

    private fun focusCommentInput() {
        commentInput.requestFocus()
        val inputMethodManager = getSystemService(INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
        inputMethodManager.showSoftInput(commentInput, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
    }

    private fun showReportToast() {
        Toast.makeText(this, R.string.live_report_unavailable, Toast.LENGTH_SHORT).show()
    }

    private fun requestGuestSeat() {
        val payload = JSONObject()
            .put("streamId", streamId)
            .put("userId", TokenManager.getUserId(this).orEmpty())
            .put("username", liveIdentityUsername)
            .put("avatar", liveIdentityAvatar)
            .put("agoraUid", agoraUid)
        SocketManager.emit("live_request_guest_seat", payload)
        Toast.makeText(this, R.string.live_guest_request_sent, Toast.LENGTH_SHORT).show()
    }

    private fun handleGuestAction(guest: xyz.yenkasa.app.model.LiveGuest, action: xyz.yenkasa.app.adapter.LiveGuestAdapter.Action) {
        val payload = JSONObject()
            .put("streamId", streamId)
            .put("guestUserId", guest.userId)
        
        when (action) {
            xyz.yenkasa.app.adapter.LiveGuestAdapter.Action.MUTE -> {
                payload.put("muted", true)
                SocketManager.emit("live_mute_guest", payload)
            }
            xyz.yenkasa.app.adapter.LiveGuestAdapter.Action.UNMUTE -> {
                payload.put("muted", false)
                SocketManager.emit("live_mute_guest", payload)
            }
            xyz.yenkasa.app.adapter.LiveGuestAdapter.Action.KICK -> {
                androidx.appcompat.app.AlertDialog.Builder(this)
                    .setTitle(R.string.remove_guest)
                    .setMessage(getString(R.string.remove_guest_confirm, guest.username))
                    .setPositiveButton(R.string.remove) { _, _ ->
                        SocketManager.emit("live_kick_guest", payload)
                    }
                    .setNegativeButton(android.R.string.cancel, null)
                    .show()
            }
        }
    }

    private fun parseGuestsExtra(raw: String?): List<LiveGuest> {
        if (raw.isNullOrBlank()) return emptyList()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val guest = LiveGuest(
                        userId = item.optString("userId"),
                        username = item.optString("username"),
                        avatar = item.optString("avatar"),
                        agoraUid = item.optInt("agoraUid"),
                        isMuted = item.optBoolean("isMuted", false),
                        isVideoStopped = item.optBoolean("isVideoStopped", false),
                        joinedAt = item.optString("joinedAt").takeIf { it.isNotBlank() }
                    )
                    if (guest.userId.isNotBlank() && isValidAgoraUid(guest.agoraUid)) add(guest)
                }
            }
        }.getOrElse { error ->
            Log.w(tag, "Failed to parse live guests extra: ${error.message}")
            emptyList()
        }
    }

    private fun shareLiveStream() {
        val title = intent.getStringExtra(EXTRA_TITLE).orEmpty().ifBlank { titleText.text.toString() }
        val shareUrl = AppLinkManager.buildLiveUrl(streamId)
        val shareText = AppLinkManager.buildShareText(
            getString(R.string.live_share_text, title),
            shareUrl
        )
        val shareIntent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, getString(R.string.share_live_stream_subject))
            putExtra(Intent.EXTRA_TEXT, shareText)
        }
        startActivity(Intent.createChooser(shareIntent, getString(R.string.share_via)))
    }

    private fun setupSocket() {
        val userId = TokenManager.getUserId(this)
        SocketManager.ensureConnected(userId)
        removeLiveSocketListeners()
        SocketManager.instance?.off(Socket.EVENT_CONNECT, socketReconnectListener)
        SocketManager.instance?.on(Socket.EVENT_CONNECT, socketReconnectListener)

        val commentListener: (Any) -> Unit = commentListener@{ data ->
            val json = data.asJson() ?: return@commentListener
            if (json.optString("streamId") != streamId) return@commentListener
            if (shouldSkipIncomingLiveEvent("comment", json)) return@commentListener
            val username = json.optString("username", getString(R.string.viewer_fallback))
            val message = json.optString("message")
            runOnUiThread { addComment(getString(R.string.live_comment_format, username, message)) }
        }
        registerLiveSocketListener("live_comment", commentListener)
        registerLiveSocketListener("new_comment", commentListener)

        val roomJoinedListener: (Any) -> Unit = roomJoinedListener@{ data ->
            val json = data.asJson() ?: return@roomJoinedListener
            if (json.optString("streamId") != streamId) return@roomJoinedListener
            if (!liveJoinAckPending && !joinedSocketRoom) return@roomJoinedListener
            liveJoinAckHandler.removeCallbacks(liveJoinRetryRunnable)
            liveJoinAckPending = false
            liveJoinRetryCount = 0
            joinedSocketRoom = true
            Log.i(
                tag,
                "Live room join confirmed. streamId=$streamId role=${json.optString("liveRole")} viewerCount=${json.optInt("viewerCount", -1)}"
            )
        }
        registerLiveSocketListener("live_room_joined", roomJoinedListener)

        val joinListener: (Any) -> Unit = joinListener@{ data ->
            val json = data.asJson() ?: return@joinListener
            if (json.optString("streamId") != streamId) return@joinListener
            if (shouldSkipIncomingLiveEvent("join", json)) return@joinListener
            val username = json.optString("username", getString(R.string.viewer_fallback))
            runOnUiThread { addComment(getString(R.string.live_user_joined, username)) }
        }
        registerLiveSocketListener("live_join", joinListener)
        registerLiveSocketListener("viewer_joined", joinListener)

        val leaveListener: (Any) -> Unit = leaveListener@{ data ->
            val json = data.asJson() ?: return@leaveListener
            if (json.optString("streamId") != streamId) return@leaveListener
            if (shouldSkipIncomingLiveEvent("leave", json)) return@leaveListener
            val username = json.optString("username", getString(R.string.viewer_fallback))
            runOnUiThread { addComment(getString(R.string.live_user_left, username)) }
        }
        registerLiveSocketListener("live_leave", leaveListener)
        registerLiveSocketListener("viewer_left", leaveListener)

        val viewerCountListener: (Any) -> Unit = viewerCountListener@{ data ->
            val json = data.asJson() ?: return@viewerCountListener
            if (json.optString("streamId") != streamId) return@viewerCountListener
            runOnUiThread { updateViewerCount(json.optInt("viewerCount", 0)) }
        }
        registerLiveSocketListener("live_viewer_count", viewerCountListener)

        val reactionListener: (Any) -> Unit = reactionListener@{ data ->
            val json = data.asJson() ?: return@reactionListener
            if (json.optString("streamId") != streamId) return@reactionListener
            if (shouldSkipIncomingLiveEvent("reaction", json)) return@reactionListener
            runOnUiThread { animateReaction(json.optString("reaction", json.optString("type", "❤️"))) }
        }
        registerLiveSocketListener("live_reaction", reactionListener)
        registerLiveSocketListener("new_like", reactionListener)

        val giftListener: (Any) -> Unit = giftListener@{ data ->
            val json = data.asJson() ?: return@giftListener
            if (json.optString("streamId") != streamId) return@giftListener
            val username = json.optString("senderUsername", getString(R.string.viewer_fallback))
            val emoji = json.optString("emoji", "❤️")
            val amount = json.optInt("amount", 0)
            runOnUiThread {
                addComment(getString(R.string.live_user_sent_gift, username, emoji, amount))
                animateReaction(emoji)
            }
        }
        registerLiveSocketListener("live_gift", giftListener)
        registerLiveSocketListener("new_gift", giftListener)
        registerLiveSocketListener("gift_animation", giftListener)

        val endedListener: (Any) -> Unit = endedListener@{ data ->
            val json = data.asJson() ?: return@endedListener
            if (json.optString("streamId") != streamId) return@endedListener
            if (shouldSkipIncomingLiveEvent("ended", json)) return@endedListener
            runOnUiThread {
                Toast.makeText(this, R.string.livestream_ended, Toast.LENGTH_SHORT).show()
                finish()
            }
        }
        registerLiveSocketListener("live_ended", endedListener)

        val guestRequestedListener: (Any) -> Unit = guestRequestedListener@{ data ->
            if (isHost) {
                val json = data.asJson() ?: return@guestRequestedListener
                if (json.optString("streamId") == streamId) {
                    runOnUiThread { showGuestRequestDialog(json) }
                }
            }
        }
        registerLiveSocketListener("live_guest_seat_requested", guestRequestedListener)

        val guestDeclinedListener: (Any) -> Unit = guestDeclinedListener@{ data ->
            val json = data.asJson() ?: return@guestDeclinedListener
            if (json.optString("streamId") == streamId) {
                runOnUiThread {
                    Toast.makeText(this, R.string.live_guest_request_declined, Toast.LENGTH_SHORT).show()
                }
            }
        }
        registerLiveSocketListener("live_guest_seat_declined", guestDeclinedListener)

        val guestApprovedListener: (Any) -> Unit = guestApprovedListener@{ data ->
            val json = data.asJson() ?: return@guestApprovedListener
            if (json.optString("streamId") == streamId) {
                val guestJson = json.optJSONObject("guest") ?: return@guestApprovedListener
                val guest = xyz.yenkasa.app.model.LiveGuest(
                    userId = guestJson.optString("userId"),
                    username = guestJson.optString("username"),
                    avatar = guestJson.optString("avatar"),
                    agoraUid = guestJson.optInt("agoraUid"),
                    isMuted = guestJson.optBoolean("isMuted", false),
                    isVideoStopped = guestJson.optBoolean("isVideoStopped", false),
                    joinedAt = guestJson.optString("joinedAt")
                )
                runOnUiThread {
                    activeGuests.removeAll { it.userId == guest.userId }
                    activeGuests.add(guest)
                    guestAdapter?.submitList(activeGuests.toList())
                    
                    if (guest.userId == TokenManager.getUserId(this)) {
                        switchRoleToBroadcaster()
                    } else {
                        addComment(getString(R.string.live_guest_joined_the_broadcast, guest.username))
                    }
                }
            }
        }
        registerLiveSocketListener("live_guest_seat_approved", guestApprovedListener)

        val guestMutedListener: (Any) -> Unit = guestMutedListener@{ data ->
            val json = data.asJson() ?: return@guestMutedListener
            if (json.optString("streamId") == streamId) {
                val guestUserId = json.optString("guestUserId")
                val isMuted = json.optBoolean("muted")
                runOnUiThread {
                    val index = activeGuests.indexOfFirst { it.userId == guestUserId }
                    if (index != -1) {
                        activeGuests[index] = activeGuests[index].copy(isMuted = isMuted)
                        guestAdapter?.submitList(activeGuests.toList())
                    }
                    if (guestUserId == TokenManager.getUserId(this)) {
                        rtcEngine?.muteLocalAudioStream(isMuted)
                        muted = isMuted
                        muteButton.setImageResource(if (muted) R.drawable.ic_volume_off else R.drawable.ic_volume_up)
                        Toast.makeText(this, if (isMuted) R.string.live_you_were_muted_by_host else R.string.mute_microphone, Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
        registerLiveSocketListener("live_guest_muted", guestMutedListener)

        val guestLeftListener: (Any) -> Unit = guestLeftListener@{ data ->
            val json = data.asJson() ?: return@guestLeftListener
            if (json.optString("streamId") == streamId) {
                val guestUserId = json.optString("guestUserId")
                runOnUiThread {
                    activeGuests.removeAll { it.userId == guestUserId }
                    guestAdapter?.submitList(activeGuests.toList())
                }
            }
        }
        registerLiveSocketListener("live_guest_left", guestLeftListener)

        val guestKickedListener: (Any) -> Unit = guestKickedListener@{ data ->
            val json = data.asJson() ?: return@guestKickedListener
            if (json.optString("streamId") == streamId) {
                val guestUserId = json.optString("guestUserId")
                runOnUiThread {
                    activeGuests.removeAll { it.userId == guestUserId }
                    guestAdapter?.submitList(activeGuests.toList())
                    if (guestUserId == TokenManager.getUserId(this)) {
                        switchRoleToAudience()
                        Toast.makeText(this, R.string.live_you_were_kicked_by_host, Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
        registerLiveSocketListener("live_guest_kicked", guestKickedListener)
    }

    private fun showGuestRequestDialog(json: JSONObject) {
        val guestUserId = json.optString("userId")
        val guestUsername = json.optString("username", getString(R.string.viewer_fallback))
        val guestAgoraUid = json.optInt("agoraUid")
        
        androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle(R.string.request_to_speak)
            .setMessage(getString(R.string.live_guest_requested_to_speak, guestUsername))
            .setPositiveButton(R.string.approve) { _, _ ->
                val payload = JSONObject()
                    .put("streamId", streamId)
                    .put("guestUserId", guestUserId)
                    .put("guestAgoraUid", guestAgoraUid)
                SocketManager.emit("live_approve_guest_seat", payload)
            }
            .setNegativeButton(R.string.decline) { _, _ ->
                val payload = JSONObject()
                    .put("streamId", streamId)
                    .put("guestUserId", guestUserId)
                SocketManager.emit("live_decline_guest_seat", payload)
            }
            .show()
    }

    private fun switchRoleToBroadcaster() {
        refreshAgoraToken(
            reason = "guest_seat_approved",
            retryJoinAfterRefresh = false,
            requestedRole = "broadcaster",
            finishOnFailure = false
        ) {
            applyGuestBroadcasterRole()
        }
    }

    private fun applyGuestBroadcasterRole() {
        rtcEngine?.setClientRole(Constants.CLIENT_ROLE_BROADCASTER)
        rtcEngine?.enableVideo()
        rtcEngine?.updateChannelMediaOptions(ChannelMediaOptions().apply {
            channelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING
            clientRoleType = Constants.CLIENT_ROLE_BROADCASTER
            publishCameraTrack = true
            publishMicrophoneTrack = true
            autoSubscribeAudio = true
            autoSubscribeVideo = true
        })
        rtcEngine?.startPreview()
        guestAdapter?.submitList(activeGuests.toList())
        buttonRequestSeat.visibility = View.GONE
        hostControls.visibility = View.VISIBLE
        muteButton.visibility = View.VISIBLE
        flipButton.visibility = View.VISIBLE
        endButton.visibility = View.GONE // Guests shouldn't end the stream
        Toast.makeText(this, R.string.live_you_are_now_broadcasting, Toast.LENGTH_SHORT).show()
    }

    private fun switchRoleToAudience() {
        rtcEngine?.setClientRole(Constants.CLIENT_ROLE_AUDIENCE)
        rtcEngine?.updateChannelMediaOptions(ChannelMediaOptions().apply {
            channelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING
            clientRoleType = Constants.CLIENT_ROLE_AUDIENCE
            publishCameraTrack = false
            publishMicrophoneTrack = false
            autoSubscribeAudio = true
            autoSubscribeVideo = true
        })
        rtcEngine?.stopPreview()
        if (isHost) {
            localView?.let { videoContainer.removeView(it) }
            localView = null
        }
        hostControls.visibility = View.GONE
        buttonRequestSeat.visibility = View.VISIBLE
    }

    private fun registerLiveSocketListener(event: String, listener: (Any) -> Unit) {
        liveSocketListeners[event]?.let { SocketManager.off(event, it) }
        liveSocketListeners[event] = SocketManager.on(event, listener)
    }

    private fun removeLiveSocketListeners() {
        liveJoinAckHandler.removeCallbacks(liveJoinRetryRunnable)
        liveSocketListeners.forEach { (event, listener) ->
            SocketManager.off(event, listener)
        }
        liveSocketListeners.clear()
        recentLiveEventKeys.clear()
        liveJoinAckPending = false
        liveJoinRetryCount = 0
    }

    private fun shouldSkipIncomingLiveEvent(type: String, json: JSONObject): Boolean {
        val now = System.currentTimeMillis()
        val iterator = recentLiveEventKeys.entries.iterator()
        while (iterator.hasNext()) {
            if (now - iterator.next().value > 5_000L) iterator.remove()
        }

        val clientEventId = json.optString("clientEventId").takeIf { it.isNotBlank() }
        if (clientEventId.isNullOrBlank()) return false
        val key = "$type:$clientEventId"

        if (recentLiveEventKeys.containsKey(key)) return true
        recentLiveEventKeys[key] = now
        return false
    }

    private fun refreshLiveIdentity() {
        liveIdentityUsername = resolveCachedLiveUsername()
        liveIdentityAvatar = resolveCachedLiveAvatar()

        ApiClient.apiService.getUserProfile().enqueue(object : Callback<User> {
            override fun onResponse(call: Call<User>, response: Response<User>) {
                val user = response.body()
                if (!response.isSuccessful || user == null) return
                user.username?.takeIf { it.isNotBlank() }?.let {
                    liveIdentityUsername = it
                    TokenManager.saveUsername(this@LiveStreamActivity, it)
                }
                user.profileImage?.takeIf { it.isNotBlank() }?.let {
                    liveIdentityAvatar = it
                    TokenManager.saveProfilePicUrl(this@LiveStreamActivity, it)
                }
                TokenManager.saveCoinsPrecise(this@LiveStreamActivity, user.resolvedCoinsBalance())
            }

            override fun onFailure(call: Call<User>, t: Throwable) = Unit
        })
    }

    private fun resolveCachedLiveUsername(): String {
        TokenManager.getUsername(this)?.takeIf { it.isNotBlank() }?.let { return it }
        runCatching {
            JSONObject(TokenManager.getUser(this).orEmpty())
                .optString("username")
                .takeIf { it.isNotBlank() }
        }.getOrNull()?.let { return it }
        return TokenManager.getUserId(this)?.takeIf { it.isNotBlank() }
            ?: getString(R.string.yenkasa_user)
    }

    private fun resolveCachedLiveAvatar(): String {
        TokenManager.getProfilePicUrl(this)?.takeIf { it.isNotBlank() }?.let { return it }
        return runCatching {
            JSONObject(TokenManager.getUser(this).orEmpty())
                .optString("profileImage")
                .takeIf { it.isNotBlank() }
        }.getOrNull().orEmpty()
    }

    private fun liveEventUsername(): String =
        TokenManager.getUsername(this)?.takeIf { it.isNotBlank() }
            ?: liveIdentityUsername.takeIf { it.isNotBlank() }
            ?: resolveCachedLiveUsername()

    private fun liveEventAvatar(): String =
        TokenManager.getProfilePicUrl(this)?.takeIf { it.isNotBlank() }
            ?: liveIdentityAvatar.takeIf { it.isNotBlank() }
            ?: resolveCachedLiveAvatar()

    private fun emitLiveJoin(force: Boolean = false) {
        if (streamId.isBlank() || !isValidAgoraUid(agoraUid)) {
            Log.w(tag, "Skipping live join emit. streamId=$streamId uid=$agoraUid host=$isHost")
            return
        }
        if (joinedSocketRoom && !force) return
        if (liveJoinAckPending && !force) return
        val userId = TokenManager.getUserId(this)
        if (userId.isNullOrBlank()) {
            Log.w(tag, "Skipping live join emit because userId is blank. streamId=$streamId uid=$agoraUid host=$isHost")
            return
        }
        val payload = JSONObject()
            .put("streamId", streamId)
            .put("userId", userId.orEmpty())
            .put("username", liveEventUsername())
            .put("avatar", liveEventAvatar())
            .put("agoraUid", agoraUid)
            .put("liveRole", if (isHost) "broadcaster" else "audience")
            .put("clientEventId", liveClientEventId("join"))
        liveJoinAckPending = true
        if (!force) liveJoinRetryCount = 0
        liveJoinAckHandler.removeCallbacks(liveJoinRetryRunnable)
        liveJoinAckHandler.postDelayed(liveJoinRetryRunnable, 4000L)
        SocketManager.emit("live_join", payload)
        Log.i(
            tag,
            "Emitted live join. streamId=$streamId userId=$userId uid=$agoraUid role=${if (isHost) "broadcaster" else "audience"} force=$force ackPending=$liveJoinAckPending retryCount=$liveJoinRetryCount"
        )
    }

    private fun handleLiveJoinAckTimeout() {
        if (!liveJoinAckPending || joinedSocketRoom) return
        if (liveJoinRetryCount >= 1) {
            Log.w(tag, "Live join ack still pending after retry. streamId=$streamId uid=$agoraUid host=$isHost")
            liveJoinAckPending = false
            return
        }

        liveJoinRetryCount += 1
        liveJoinAckPending = false
        Log.w(tag, "Retrying live join after missing ack. streamId=$streamId uid=$agoraUid host=$isHost")
        emitLiveJoin(force = true)
    }

    private fun emitHostReady(force: Boolean = false) {
        if (hostReadyEmitted && !force) return
        val userId = TokenManager.getUserId(this)
        SocketManager.emit(
            "live_host_ready",
            JSONObject()
                .put("streamId", streamId)
                .put("userId", userId.orEmpty())
                .put("username", liveEventUsername())
                .put("avatar", liveEventAvatar())
                .put("agoraUid", agoraUid)
                .put("liveRole", "broadcaster")
        )
        hostReadyEmitted = true
        hostHeartbeatHandler.removeCallbacks(hostHeartbeatRunnable)
        hostHeartbeatHandler.post(hostHeartbeatRunnable)
    }

    private fun emitHostHeartbeat() {
        if (!isHost || !hostReadyEmitted) return
        SocketManager.emit(
            "live_host_heartbeat",
            JSONObject()
                .put("streamId", streamId)
                .put("userId", TokenManager.getUserId(this).orEmpty())
                .put("agoraUid", agoraUid)
                .put("liveRole", "broadcaster")
        )
    }

    private fun ensureAgoraPermissionsThenStart() {
        val missing = requiredAgoraPermissions()
            .filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()
        Log.i(
            tag,
            "Agora permission check. missing=${missing.toList()} host=$isHost streamId=$streamId channel=$channelName uid=$agoraUid"
        )
        if (missing.isEmpty()) {
            initializeAgora()
        } else {
            agoraPermissionLauncher.launch(missing)
        }
    }

    private fun requiredAgoraPermissions(): Array<String> {
        return arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    }

    private fun hasAgoraPermissions(): Boolean {
        return requiredAgoraPermissions().all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    private fun agoraPermissionDeniedMessage(): Int {
        return if (isHost) {
            R.string.camera_mic_permissions_required
        } else {
            R.string.live_audience_permissions_required
        }
    }

    private fun initializeAgora() {
        if (agoraAppId.isBlank() || channelName.isBlank() || agoraToken.isBlank() || !isValidAgoraUid(agoraUid)) {
            Log.e(
                tag,
                "Agora startup missing/invalid token data. appIdBlank=${agoraAppId.isBlank()} channelBlank=${channelName.isBlank()} tokenBlank=${agoraToken.isBlank()} tokenUid=$agoraUid streamId=$streamId host=$isHost"
            )
            Toast.makeText(
                this,
                if (isValidAgoraUid(agoraUid)) R.string.livestream_token_missing else R.string.live_video_credentials_invalid,
                Toast.LENGTH_LONG
            ).show()
            if (isHost) cancelStartingLive()
            finish()
            return
        }
        if (!hasAgoraPermissions()) {
            Log.w(tag, "Blocked Agora startup without runtime permissions. host=$isHost streamId=$streamId channel=$channelName uid=$agoraUid")
            Toast.makeText(this, agoraPermissionDeniedMessage(), Toast.LENGTH_LONG).show()
            if (isHost && !hostReadyEmitted) cancelStartingLive()
            finish()
            return
        }

        Log.i(
            tag,
            "Creating Agora engine. host=$isHost streamId=$streamId channel=$channelName uid=$agoraUid cameraGranted=${ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED} micGranted=${ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED}"
        )

        rtcEngine = RtcEngine.create(applicationContext, agoraAppId, rtcHandler).apply {
            setChannelProfile(Constants.CHANNEL_PROFILE_LIVE_BROADCASTING)
            setClientRole(if (isHost) Constants.CLIENT_ROLE_BROADCASTER else Constants.CLIENT_ROLE_AUDIENCE)
            enableVideo()
            setVideoEncoderConfiguration(
                io.agora.rtc2.video.VideoEncoderConfiguration(
                    io.agora.rtc2.video.VideoEncoderConfiguration.VD_1280x720,
                    io.agora.rtc2.video.VideoEncoderConfiguration.FRAME_RATE.FRAME_RATE_FPS_24,
                    io.agora.rtc2.video.VideoEncoderConfiguration.STANDARD_BITRATE,
                    io.agora.rtc2.video.VideoEncoderConfiguration.ORIENTATION_MODE.ORIENTATION_MODE_ADAPTIVE
                )
            )
        }

        if (isHost) setupLocalVideo()
        joinAgoraChannel("initial")
    }

    private fun joinAgoraChannel(reason: String) {
        if (!hasAgoraPermissions()) {
            Log.w(tag, "Blocked Agora join without runtime permissions. reason=$reason streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
            Toast.makeText(this, agoraPermissionDeniedMessage(), Toast.LENGTH_LONG).show()
            if (isHost && !hostReadyEmitted) cancelStartingLive()
            finish()
            return
        }
        if (!isValidAgoraUid(agoraUid)) {
            Log.e(tag, "Blocked Agora join with invalid UID. reason=$reason streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
            Toast.makeText(this, R.string.live_video_credentials_invalid, Toast.LENGTH_LONG).show()
            if (isHost && !hostReadyEmitted) cancelStartingLive()
            finish()
            return
        }
        val options = ChannelMediaOptions().apply {
            channelProfile = Constants.CHANNEL_PROFILE_LIVE_BROADCASTING
            clientRoleType = if (isHost) Constants.CLIENT_ROLE_BROADCASTER else Constants.CLIENT_ROLE_AUDIENCE
            publishCameraTrack = isHost
            publishMicrophoneTrack = isHost
            autoSubscribeAudio = true
            autoSubscribeVideo = true
        }
        val result = rtcEngine?.joinChannel(agoraToken, channelName, agoraUid, options) ?: -1
        Log.i(
            tag,
            "Agora joinChannel requested. reason=$reason result=$result streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost publishCamera=${options.publishCameraTrack} publishMic=${options.publishMicrophoneTrack} tokenExpiresAt=${intent.getLongExtra(EXTRA_EXPIRES_AT, 0L)}"
        )
        if (result < 0) {
            if (!joinRetried) {
                retryAgoraJoin("join_result_$result")
            } else {
                Toast.makeText(this, getString(R.string.live_agora_join_failed_with_code, result), Toast.LENGTH_LONG).show()
                if (isHost && !hostReadyEmitted) cancelStartingLive()
                finish()
            }
        }
    }

    private fun retryAgoraJoin(reason: String) {
        if (joinRetried || isFinishing || isDestroyed) return
        joinRetried = true
        Log.w(tag, "Retrying Agora join once. reason=$reason streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost")
        rtcEngine?.leaveChannel()
        videoContainer.postDelayed({ joinAgoraChannel("retry_$reason") }, 1_000L)
    }

    private fun refreshAgoraToken(
        reason: String,
        retryJoinAfterRefresh: Boolean,
        requestedRole: String = if (isHost) "broadcaster" else "audience",
        finishOnFailure: Boolean = true,
        onRefreshed: (() -> Unit)? = null
    ) {
        if (tokenRefreshInFlight || streamId.isBlank()) return
        tokenRefreshInFlight = true
        Log.i(tag, "Refreshing Agora token. reason=$reason streamId=$streamId channel=$channelName uid=$agoraUid host=$isHost requestedRole=$requestedRole")
        ApiClient.apiService.joinLiveStream(
            streamId,
            xyz.yenkasa.app.model.JoinLiveStreamRequest(requestedRole)
        ).enqueue(object : Callback<LiveStreamResponse> {
            override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                tokenRefreshInFlight = false
                val body = response.body()
                val token = body?.agora
                val stream = body?.stream
                if (!response.isSuccessful || body?.success != true || token == null || stream == null) {
                    Log.w(
                        tag,
                        "Agora token refresh rejected. reason=$reason http=${response.code()} code=${body?.code} message=${body?.message} streamId=$streamId"
                    )
                    Toast.makeText(
                        this@LiveStreamActivity,
                        body?.message ?: getString(R.string.live_token_refresh_failed),
                        Toast.LENGTH_LONG
                    ).show()
                    if (finishOnFailure) {
                        if (isHost && !hostReadyEmitted) cancelStartingLive()
                        finish()
                    }
                    return
                }

                val refreshedUid = token.uid
                if (!isValidAgoraUid(refreshedUid)) {
                    Log.e(
                        tag,
                        "Agora token refresh returned invalid UID. reason=$reason streamId=$streamId channel=${stream.agoraChannel} oldUid=$agoraUid newUid=$refreshedUid role=${token.role}"
                    )
                    Toast.makeText(this@LiveStreamActivity, R.string.live_video_credentials_invalid, Toast.LENGTH_LONG).show()
                    if (finishOnFailure) {
                        if (isHost && !hostReadyEmitted) cancelStartingLive()
                        finish()
                    }
                    return
                }
                if (refreshedUid != agoraUid) {
                    Log.e(
                        tag,
                        "Agora token refresh UID mismatch. reason=$reason streamId=$streamId channel=${stream.agoraChannel} oldUid=$agoraUid newUid=$refreshedUid role=${token.role}"
                    )
                    Toast.makeText(this@LiveStreamActivity, R.string.live_video_credentials_invalid, Toast.LENGTH_LONG).show()
                    if (finishOnFailure) {
                        if (isHost && !hostReadyEmitted) cancelStartingLive()
                        finish()
                    }
                    return
                }

                agoraToken = token.token
                agoraAppId = token.appId
                channelName = stream.agoraChannel
                Log.i(
                    tag,
                    "Agora token refreshed. reason=$reason streamId=$streamId channel=$channelName tokenUid=$refreshedUid joinUid=$agoraUid role=${token.role} expiresAt=${token.expiresAt}"
                )
                rtcEngine?.renewToken(agoraToken)
                if (retryJoinAfterRefresh) retryAgoraJoin("token_refresh_$reason")
                onRefreshed?.invoke()
            }

            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                tokenRefreshInFlight = false
                Log.e(tag, "Agora token refresh transport failure. reason=$reason ${t.javaClass.simpleName}: ${t.message}", t)
                Toast.makeText(
                    this@LiveStreamActivity,
                    R.string.live_token_refresh_failed,
                    Toast.LENGTH_LONG
                ).show()
                if (finishOnFailure) {
                    if (isHost && !hostReadyEmitted) cancelStartingLive()
                    finish()
                }
            }
        })
    }

    private fun shouldRefreshTokenForAgoraError(err: Int): Boolean {
        return err == 109 || err == 110
    }

    private fun agoraUserMessage(err: Int): String {
        return when (err) {
            109, 110 -> getString(R.string.live_token_expired_user_message)
            17 -> getString(R.string.live_join_setup_failed)
            101 -> getString(R.string.live_video_credentials_invalid)
            else -> getString(R.string.live_video_join_failed)
        }
    }

    private fun setupLocalVideo() {
        if (localView != null) return
        localView = SurfaceView(this)
        videoContainer.addView(localView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        rtcEngine?.setupLocalVideo(VideoCanvas(localView, VideoCanvas.RENDER_MODE_HIDDEN, agoraUid))
        rtcEngine?.startPreview()
    }

    private fun setupRemoteVideo(uid: Int) {
        if (activeGuests.any { it.agoraUid == uid }) {
            guestAdapter?.submitList(activeGuests.toList())
            return
        }
        if (isHost) return
        if (remoteView != null) return
        remoteView = SurfaceView(this)
        videoContainer.addView(remoteView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        rtcEngine?.setupRemoteVideo(VideoCanvas(remoteView, VideoCanvas.RENDER_MODE_HIDDEN, uid))
    }

    private fun sendComment() {
        val message = commentInput.text.toString().trim()
        if (message.isBlank()) return
        commentInput.text?.clear()
        val payload = JSONObject()
            .put("streamId", streamId)
            .put("userId", TokenManager.getUserId(this).orEmpty())
            .put("username", liveEventUsername())
            .put("avatar", liveEventAvatar())
            .put("agoraUid", agoraUid)
            .put("liveRole", if (isHost) "broadcaster" else "audience")
            .put("message", message)
            .put("clientEventId", liveClientEventId("comment"))
        SocketManager.emit("live_comment", payload)
    }

    private fun sendReaction(reaction: String) {
        val now = System.currentTimeMillis()
        if (now - lastReactionAt < 300L) return
        lastReactionAt = now

        // Immediate local visual feedback
        animateReaction(reaction)

        val payload = JSONObject()
            .put("streamId", streamId)
            .put("userId", TokenManager.getUserId(this).orEmpty())
            .put("username", liveEventUsername())
            .put("avatar", liveEventAvatar())
            .put("agoraUid", agoraUid)
            .put("liveRole", if (isHost) "broadcaster" else "audience")
            .put("reaction", reaction)
            .put("clientEventId", liveClientEventId("reaction"))
        SocketManager.emit("live_reaction", payload)
    }

    private fun showGiftSheet() {
        val gifts = listOf(
            Triple("love", getString(R.string.gift_love), 5),
            Triple("fire", getString(R.string.gift_fire), 10),
            Triple("crown", getString(R.string.gift_crown), 50),
            Triple("rocket", getString(R.string.gift_rocket), 100),
            Triple("diamond", getString(R.string.gift_diamond), 500),
            Triple("galaxy", getString(R.string.gift_galaxy), 1000)
        )
        val dialog = BottomSheetDialog(this)
        val sheet = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(18))
            setBackgroundColor(Color.rgb(18, 18, 18))
        }
        sheet.addView(TextView(this).apply {
            text = getString(R.string.send_ykc_gift)
            setTextColor(Color.WHITE)
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        sheet.addView(TextView(this).apply {
            text = getString(R.string.ykc_balance_format, TokenManager.getCoinsPrecise(this@LiveStreamActivity))
            setTextColor(Color.LTGRAY)
            textSize = 13f
            setPadding(0, dp(4), 0, dp(10))
        })
        gifts.forEach { (key, label, amount) ->
            sheet.addView(Button(this).apply {
                text = getString(R.string.gift_option_format, label, amount)
                setTextColor(Color.WHITE)
                // Use a modern green button style
                background = ContextCompat.getDrawable(context, R.drawable.bg_live_send_button)
                backgroundTintList = android.content.res.ColorStateList.valueOf(Color.rgb(0, 132, 61))
                isAllCaps = false
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(48)
                ).apply {
                    setMargins(0, 0, 0, dp(8))
                }
                layoutParams = params
                setOnClickListener {
                    dialog.dismiss()
                    sendGift(key, label, amount)
                }
            })
        }
        dialog.setContentView(sheet)
        dialog.show()
    }

    private fun sendGift(giftKey: String, label: String, amount: Int) {
        ApiClient.apiService.sendLiveGift(LiveGiftRequest(streamId, giftKey))
            .enqueue(object : Callback<LiveGiftResponse> {
                override fun onResponse(call: Call<LiveGiftResponse>, response: Response<LiveGiftResponse>) {
                    val body = response.body()
                    if (!response.isSuccessful || body?.success != true) {
                        Toast.makeText(this@LiveStreamActivity, body?.message ?: getString(R.string.gift_failed), Toast.LENGTH_SHORT).show()
                        return
                    }

                    // Success: Immediate local feedback
                    val emoji = when (giftKey) {
                        "love" -> "❤️"
                        "fire" -> "🔥"
                        "crown" -> "👑"
                        "rocket" -> "🚀"
                        "diamond" -> "💎"
                        "galaxy" -> "🌌"
                        else -> "🎁"
                    }
                    addComment(getString(R.string.live_user_sent_gift, getString(R.string.you), emoji, amount))
                    animateReaction(emoji)

                    val updatedBalance = body.ykcBalance ?: body.coinsBalance ?: body.balance
                    TokenManager.saveCoinsPrecise(this@LiveStreamActivity, updatedBalance)
                }

                override fun onFailure(call: Call<LiveGiftResponse>, t: Throwable) {
                    Toast.makeText(this@LiveStreamActivity, R.string.network_error_sending_gift, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addComment(text: String) {
        val parts = text.split(":", limit = 2)
        val username = parts.firstOrNull()?.trim().orEmpty()
        val message = parts.getOrNull(1)?.trim()

        val comment = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(12), dp(8))
            background = ContextCompat.getDrawable(this@LiveStreamActivity, R.drawable.bg_live_comment_card)
            elevation = dp(2).toFloat()
        }
        comment.addView(TextView(this).apply {
            this.text = initialsFor(username)
            gravity = android.view.Gravity.CENTER
            setTextColor(Color.WHITE)
            textSize = 12f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            background = ContextCompat.getDrawable(this@LiveStreamActivity, R.drawable.bg_live_avatar_comment)
        }, LinearLayout.LayoutParams(dp(34), dp(34)))

        comment.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(9), 0, 0, 0)
            addView(TextView(this@LiveStreamActivity).apply {
                this.text = username.ifBlank { getString(R.string.viewer_fallback) }
                setTextColor(ContextCompat.getColor(this@LiveStreamActivity, R.color.yenkasa_emerald))
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
            addView(TextView(this@LiveStreamActivity).apply {
                this.text = message ?: text
                setTextColor(Color.rgb(56, 56, 56))
                textSize = 14f
                maxLines = 2
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))

        val marginParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = dp(8)
        }
        commentsContainer.addView(comment, marginParams)
        while (commentsContainer.childCount > 5) {
            commentsContainer.removeViewAt(0)
        }
    }

    private fun initialsFor(value: String): String {
        return value.split(" ", ".", "_", "-")
            .mapNotNull { it.firstOrNull()?.uppercaseChar()?.toString() }
            .take(2)
            .joinToString("")
            .ifBlank { "Y" }
    }

    private fun updateViewerCount(count: Int) {
        viewerText.text = getString(R.string.live_viewers_short, count.coerceAtLeast(0))
    }

    private fun animateReaction(reaction: String) {
        val view = TextView(this).apply {
            text = reaction
            textSize = 30f
            alpha = 0f
        }
        val startX = (reactionsLayer.width - dp(86)).coerceAtLeast(dp(24)).toFloat()
        val startY = (reactionsLayer.height - dp(170)).coerceAtLeast(dp(120)).toFloat()
        reactionsLayer.addView(view, FrameLayout.LayoutParams(dp(54), dp(54)))
        view.translationX = startX
        view.translationY = startY
        view.animate()
            .alpha(1f)
            .translationY(startY - dp(180))
            .translationX(startX - dp((0..38).random()))
            .setDuration(1300L)
            .withEndAction { reactionsLayer.removeView(view) }
            .start()
    }

    private fun updateTimer() {
        val remaining = scheduledEndAtMillis - System.currentTimeMillis()
        if (remaining <= 0L) {
            timerText.text = getString(R.string.ending_ellipsis)
            timerText.setTextColor(Color.RED)
            return
        }
        val minutes = remaining / 60_000L
        val seconds = (remaining / 1_000L) % 60L
        timerText.text = if (minutes > 0) {
            getString(R.string.minutes_remaining, minutes)
        } else {
            getString(R.string.seconds_remaining, seconds)
        }
        timerText.setTextColor(if (remaining <= 120_000L) Color.RED else Color.WHITE)
    }

    private fun endLiveAndFinish() {
        if (!isHost) {
            finish()
            return
        }
        endRequestSent = true
        ApiClient.apiService.endLiveStream(streamId).enqueue(object : Callback<LiveStreamResponse> {
            override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) {
                finish()
            }

            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) {
                Toast.makeText(this@LiveStreamActivity, R.string.could_not_end_live_cleanly, Toast.LENGTH_SHORT).show()
                finish()
            }
        })
    }

    override fun onPause() {
        super.onPause()
        if (isHost) rtcEngine?.muteLocalVideoStream(true)
    }

    override fun onResume() {
        super.onResume()
        if (isHost) rtcEngine?.muteLocalVideoStream(false)
    }

    override fun onDestroy() {
        leaveLive()
        super.onDestroy()
    }

    private fun leaveLive() {
        hostHeartbeatHandler.removeCallbacks(hostHeartbeatRunnable)
        liveJoinAckHandler.removeCallbacks(liveJoinRetryRunnable)
        if (joinedSocketRoom) {
            val payload = JSONObject()
                .put("streamId", streamId)
                .put("userId", TokenManager.getUserId(this).orEmpty())
                .put("username", liveEventUsername())
                .put("avatar", liveEventAvatar())
                .put("agoraUid", agoraUid)
                .put("liveRole", if (isHost) "broadcaster" else "audience")
                .put("clientEventId", liveClientEventId("leave"))
            SocketManager.emit("live_leave", payload)
            joinedSocketRoom = false
        }
        liveJoinAckPending = false
        liveJoinRetryCount = 0
        if (isHost && !hostReadyEmitted && !endRequestSent) {
            cancelStartingLive()
        }
        removeLiveSocketListeners()
        SocketManager.instance?.off(Socket.EVENT_CONNECT, socketReconnectListener)
        timerHandler.removeCallbacks(timerRunnable)

        rtcEngine?.leaveChannel()
        rtcEngine?.stopPreview()
        rtcEngine = null
        RtcEngine.destroy()
    }

    private fun cancelStartingLive() {
        if (streamId.isBlank()) return
        endRequestSent = true
        ApiClient.apiService.endLiveStream(streamId).enqueue(object : Callback<LiveStreamResponse> {
            override fun onResponse(call: Call<LiveStreamResponse>, response: Response<LiveStreamResponse>) = Unit
            override fun onFailure(call: Call<LiveStreamResponse>, t: Throwable) = Unit
        })
    }

    override fun onBackPressed() {
        if (isHost) endLiveAndFinish() else super.onBackPressed()
    }

    private fun Any.asJson(): JSONObject? {
        return when (this) {
            is JSONObject -> this
            else -> runCatching { JSONObject(toString()) }.getOrNull()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun parseIsoMillis(value: String?): Long {
        if (value.isNullOrBlank()) return 0L
        return runCatching {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.parse(value)?.time ?: 0L
        }.getOrDefault(0L)
    }

    private fun liveClientEventId(type: String): String {
        return "$streamId:$type:${UUID.randomUUID()}"
    }

    private fun isValidAgoraUid(uid: Int?): Boolean = uid != null && uid > 0

    companion object {
        private const val INVALID_AGORA_UID = -1
        private const val EXTRA_STREAM_ID = "stream_id"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_HOST = "host"
        private const val EXTRA_COMMUNITY = "community"
        private const val EXTRA_CHANNEL = "channel"
        private const val EXTRA_TOKEN = "token"
        private const val EXTRA_APP_ID = "app_id"
        private const val EXTRA_UID = "uid"
        private const val EXTRA_IS_HOST = "is_host"
        private const val EXTRA_SCHEDULED_END_AT = "scheduled_end_at"
        private const val EXTRA_EXPIRES_AT = "expires_at"
        private const val EXTRA_GUESTS = "guests"

        fun intentForHost(context: Context, stream: LiveStream, agora: AgoraLiveToken): Intent {
            return baseIntent(context, stream, agora, true)
        }

        fun intentForAudience(context: Context, stream: LiveStream, agora: AgoraLiveToken): Intent {
            return baseIntent(context, stream, agora, false)
        }

        private fun baseIntent(context: Context, stream: LiveStream, agora: AgoraLiveToken, isHost: Boolean): Intent {
            return Intent(context, LiveStreamActivity::class.java)
                .putExtra(EXTRA_STREAM_ID, stream.id)
                .putExtra(EXTRA_TITLE, stream.title)
                .putExtra(EXTRA_HOST, stream.hostUsername)
                .putExtra(EXTRA_COMMUNITY, stream.community)
                .putExtra(EXTRA_CHANNEL, stream.agoraChannel)
                .putExtra(EXTRA_TOKEN, agora.token)
                .putExtra(EXTRA_APP_ID, agora.appId)
                .putExtra(EXTRA_UID, agora.uid ?: INVALID_AGORA_UID)
                .putExtra(EXTRA_EXPIRES_AT, agora.expiresAt)
                .putExtra(EXTRA_IS_HOST, isHost)
                .putExtra(EXTRA_SCHEDULED_END_AT, stream.scheduledEndAt)
                .putExtra(EXTRA_GUESTS, guestsJson(stream.guests))
        }

        private fun guestsJson(guests: List<LiveGuest>): String {
            val array = JSONArray()
            guests.forEach { guest ->
                array.put(
                    JSONObject()
                        .put("userId", guest.userId)
                        .put("username", guest.username)
                        .put("avatar", guest.avatar)
                        .put("agoraUid", guest.agoraUid)
                        .put("isMuted", guest.isMuted)
                        .put("isVideoStopped", guest.isVideoStopped)
                        .put("joinedAt", guest.joinedAt)
                )
            }
            return array.toString()
        }
    }
}
