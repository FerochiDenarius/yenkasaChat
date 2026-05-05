package xyz.yenkasa.app.ui

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.LiveActivityAdapter
import xyz.yenkasa.app.adapter.LiveMetricCardAdapter
import xyz.yenkasa.app.model.LiveActivityEvent
import xyz.yenkasa.app.model.LiveDuelEnvelope
import xyz.yenkasa.app.model.LiveDuelState
import xyz.yenkasa.app.model.LiveEventMode
import xyz.yenkasa.app.model.LiveLeaderboardSection
import xyz.yenkasa.app.model.LiveMicroReward
import xyz.yenkasa.app.model.LiveMetricsResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager

class YenkasaLiveSheetController(
    private val fragment: Fragment,
    private val onQuickAction: (String) -> Unit
) {
    private val pulseHandler = Handler(Looper.getMainLooper())
    private val pollHandler = Handler(Looper.getMainLooper())
    private var liveDialog: BottomSheetDialog? = null
    private var fab: FloatingActionButton? = null
    private var pulseRunnable: Runnable? = null
    private var pollRunnable: Runnable? = null
    private var selectedWindow: String = "5m"
    private var activeCall: Call<LiveMetricsResponse>? = null
    private var duelActionCall: Call<LiveDuelEnvelope>? = null
    private var hostResumed = true
    private var lastResponseSignature: String? = null
    private var nextPollDelayMs: Long = 5000L
    private var latestResponse: LiveMetricsResponse? = null
    private var currentUserRanks: Map<String, Int> = emptyMap()

    private var contentScroll: View? = null
    private var loadingView: View? = null
    private var errorView: View? = null
    private var errorTextView: TextView? = null
    private var eventBannerView: View? = null
    private var eventTitleView: TextView? = null
    private var eventSubtitleView: TextView? = null
    private var duelCardView: View? = null
    private var duelMatchupView: TextView? = null
    private var duelMetricView: TextView? = null
    private var duelYouScoreView: TextView? = null
    private var duelOpponentLabelView: TextView? = null
    private var duelOpponentScoreView: TextView? = null
    private var duelTimerView: TextView? = null
    private var duelActionView: TextView? = null
    private var rewardCardView: View? = null
    private var rewardTitleView: TextView? = null
    private var rewardSubtitleView: TextView? = null
    private var streakCardView: View? = null
    private var streakTitleView: TextView? = null
    private var streakSubtitleView: TextView? = null

    private val metricAdapter = LiveMetricCardAdapter { section ->
        onQuickAction(section.action.ifBlank { "comment" })
        liveDialog?.dismiss()
    }
    private val activityAdapter = LiveActivityAdapter()

    fun attach(fabButton: FloatingActionButton) {
        fab = fabButton
        fabButton.setOnClickListener { openSheet() }
        startPulse()
    }

    fun detach() {
        stopPolling()
        stopPulse()
        activeCall?.cancel()
        duelActionCall?.cancel()
        liveDialog?.dismiss()
        liveDialog = null
        fab = null
        contentScroll = null
        loadingView = null
        errorView = null
        errorTextView = null
        eventBannerView = null
        eventTitleView = null
        eventSubtitleView = null
        duelCardView = null
        duelMatchupView = null
        duelMetricView = null
        duelYouScoreView = null
        duelOpponentLabelView = null
        duelOpponentScoreView = null
        duelTimerView = null
        duelActionView = null
        rewardCardView = null
        rewardTitleView = null
        rewardSubtitleView = null
        streakCardView = null
        streakTitleView = null
        streakSubtitleView = null
    }

    fun onHostResume() {
        hostResumed = true
        if (liveDialog?.isShowing == true) {
            fetchMetrics(showLoader = latestResponse == null)
            startPolling()
        }
    }

    fun onHostPause() {
        hostResumed = false
        stopPolling()
    }

    private fun openSheet() {
        val context = fragment.context ?: return
        val view = LayoutInflater.from(context).inflate(R.layout.bottomsheet_yenkasa_live, null, false)
        val dialog = BottomSheetDialog(context)
        dialog.setContentView(view)
        dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED
        dialog.setOnDismissListener {
            stopPolling()
            activeCall?.cancel()
        }
        liveDialog = dialog

        val closeButton = view.findViewById<ImageView>(R.id.buttonCloseLive)
        val liveDot = view.findViewById<View>(R.id.viewLiveDot)
        val recyclerCards = view.findViewById<RecyclerView>(R.id.recyclerLiveCards)
        val recyclerActivity = view.findViewById<RecyclerView>(R.id.recyclerLiveActivity)
        val chip5m = view.findViewById<TextView>(R.id.chipLive5m)
        val chip1h = view.findViewById<TextView>(R.id.chipLive1h)
        val chipToday = view.findViewById<TextView>(R.id.chipLiveToday)
        contentScroll = view.findViewById(R.id.liveContentScroll)
        loadingView = view.findViewById(R.id.layoutLiveLoading)
        errorView = view.findViewById(R.id.layoutLiveError)
        errorTextView = view.findViewById(R.id.textLiveError)
        eventBannerView = view.findViewById(R.id.layoutLiveEventBanner)
        eventTitleView = view.findViewById(R.id.textLiveEventTitle)
        eventSubtitleView = view.findViewById(R.id.textLiveEventSubtitle)
        duelCardView = view.findViewById(R.id.layoutLiveDuelCard)
        duelMatchupView = view.findViewById(R.id.textLiveDuelMatchup)
        duelMetricView = view.findViewById(R.id.textLiveDuelMetric)
        duelYouScoreView = view.findViewById(R.id.textLiveDuelYouScore)
        duelOpponentLabelView = view.findViewById(R.id.textLiveDuelOpponentLabel)
        duelOpponentScoreView = view.findViewById(R.id.textLiveDuelOpponentScore)
        duelTimerView = view.findViewById(R.id.textLiveDuelTimer)
        duelActionView = view.findViewById(R.id.buttonLiveDuelAction)
        rewardCardView = view.findViewById(R.id.layoutLiveRewardCard)
        rewardTitleView = view.findViewById(R.id.textLiveRewardTitle)
        rewardSubtitleView = view.findViewById(R.id.textLiveRewardSubtitle)
        streakCardView = view.findViewById(R.id.layoutLiveStreakCard)
        streakTitleView = view.findViewById(R.id.textLiveStreakTitle)
        streakSubtitleView = view.findViewById(R.id.textLiveStreakSubtitle)

        recyclerCards.layoutManager = LinearLayoutManager(context)
        recyclerCards.adapter = metricAdapter

        recyclerActivity.layoutManager = LinearLayoutManager(context)
        recyclerActivity.adapter = activityAdapter

        closeButton.setOnClickListener { dialog.dismiss() }
        view.findViewById<View>(R.id.buttonRetryLive).setOnClickListener {
            fetchMetrics(showLoader = latestResponse == null)
        }
        view.findViewById<View>(R.id.actionLiveComment).setOnClickListener {
            onQuickAction("comment")
            dialog.dismiss()
        }
        view.findViewById<View>(R.id.actionLiveView).setOnClickListener {
            onQuickAction("view")
            dialog.dismiss()
        }
        view.findViewById<View>(R.id.actionLiveLike).setOnClickListener {
            onQuickAction("like")
            dialog.dismiss()
        }
        view.findViewById<View>(R.id.actionLiveFollow).setOnClickListener {
            onQuickAction("follow")
            dialog.dismiss()
        }

        val chips = mapOf("5m" to chip5m, "1h" to chip1h, "today" to chipToday)
        fun applyChipState(activeKey: String) {
            chips.forEach { (key, chip) ->
                val active = key == activeKey
                chip.background = ContextCompat.getDrawable(
                    context,
                    if (active) R.drawable.bg_live_chip_active else R.drawable.bg_live_chip_inactive
                )
                chip.setTextColor(
                    ContextCompat.getColor(
                        context,
                        if (active) android.R.color.white else R.color.feed_secondary_text
                    )
                )
            }
        }

        chip5m.setOnClickListener {
            selectedWindow = "5m"
            applyChipState(selectedWindow)
            fetchMetrics(showLoader = true, force = true)
        }
        chip1h.setOnClickListener {
            selectedWindow = "1h"
            applyChipState(selectedWindow)
            fetchMetrics(showLoader = true, force = true)
        }
        chipToday.setOnClickListener {
            selectedWindow = "today"
            applyChipState(selectedWindow)
            fetchMetrics(showLoader = true, force = true)
        }
        applyChipState(selectedWindow)

        animateLiveDot(liveDot)
        dialog.setOnShowListener {
            dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)?.let { sheet ->
                val metrics = context.resources.displayMetrics
                sheet.layoutParams = sheet.layoutParams.apply {
                    height = (metrics.heightPixels * 0.9f).toInt()
                }
                sheet.requestLayout()
            }
        }

        dialog.show()
        fetchMetrics(showLoader = true, force = true)
        startPolling()
    }

    private fun fetchMetrics(showLoader: Boolean = false, force: Boolean = false) {
        val context = fragment.context ?: return
        val token = TokenManager.getToken(context).orEmpty()
        if (token.isBlank()) return
        if (!hostResumed && !force) return

        if (showLoader) {
            showLoading()
        } else {
            hideError()
        }

        activeCall?.cancel()
        activeCall = ApiClient.apiService.getLiveMetrics("Bearer $token", selectedWindow)
        activeCall?.enqueue(object : Callback<LiveMetricsResponse> {
            override fun onResponse(call: Call<LiveMetricsResponse>, response: Response<LiveMetricsResponse>) {
                val body = response.body()
                if (!response.isSuccessful || body == null) {
                    showError("⚠️ Live data unavailable. Pull to refresh.")
                    return
                }

                hideLoadingAndError()
                bindLiveMetrics(body)
            }

            override fun onFailure(call: Call<LiveMetricsResponse>, t: Throwable) {
                if (call.isCanceled) return
                showError("⚠️ Live data unavailable. Pull to refresh.")
            }
        })
    }

    private fun bindLiveMetrics(body: LiveMetricsResponse) {
        val sections = highlightRankChanges(
            listOf(body.topCommenters, body.topViews, body.topConnectors, body.topYKC)
        )
        metricAdapter.submitSections(sections)
        bindActiveEvent(body.activeEvent)
        bindMicroReward(body.microReward)
        bindConversationStreak(body.conversationStreak?.message)
        bindDuel(body.duel)

        val overtakeEvents = body.events.mapIndexed { index, eventText ->
            LiveActivityEvent(
                id = "event-${body.generatedAt ?: System.currentTimeMillis()}-$index-${eventText.hashCode()}",
                type = "event",
                text = eventText,
                createdAt = body.generatedAt,
                isCurrentUser = eventText.contains("You")
            )
        }

        val feedEvents = if (body.activityFeed.isNotEmpty()) {
            body.activityFeed
        } else {
            listOf(
                LiveActivityEvent(
                    id = "empty",
                    type = "info",
                    text = "⚡ Competition is live. Make a move now.",
                    createdAt = body.generatedAt
                )
            )
        }

        val mergedEvents = (overtakeEvents + feedEvents)
            .distinctBy { it.id.ifBlank { "${it.type}:${it.text}" } }
            .take(10)
        activityAdapter.submitEvents(mergedEvents)

        val signature = buildResponseSignature(body)
        nextPollDelayMs = if (signature == lastResponseSignature) 9000L else 5000L
        lastResponseSignature = signature
        latestResponse = body
    }

    private fun bindActiveEvent(activeEvent: LiveEventMode?) {
        val hasEvent = activeEvent != null
        eventBannerView?.isVisible = hasEvent
        if (!hasEvent) return

        eventTitleView?.text = "${activeEvent?.name.orEmpty()} is ON"
        eventSubtitleView?.text = "${activeEvent?.bonusMultiplier ?: 1.0}x YKC rewards • ${activeEvent?.duration.orEmpty()}"
    }

    private fun bindMicroReward(microReward: LiveMicroReward?) {
        val hasReward = microReward != null
        rewardCardView?.isVisible = hasReward
        if (!hasReward) return

        rewardTitleView?.text = "🎯 Next burst reward"
        val commenter = microReward?.topCommenter
        val viewer = microReward?.topViewer
        val commenterText = commenter?.let {
            "${if (it.isCurrentUser) "You" else it.username} lead comments (${it.count})"
        } ?: "No comment leader yet"
        val viewerText = viewer?.let {
            "${if (it.isCurrentUser) "You" else it.username} lead views (${it.count})"
        } ?: "No view leader yet"
        rewardSubtitleView?.text =
            "Top commenter +${microReward?.rewardAmount ?: 0} YKC • $commenterText • $viewerText"
    }

    private fun bindConversationStreak(streakMessage: String?) {
        val hasStreak = !streakMessage.isNullOrBlank()
        streakCardView?.isVisible = hasStreak
        if (!hasStreak) return

        streakTitleView?.text = streakMessage
        streakSubtitleView?.text = "⚡ Stay active in Live to maintain it"
    }

    private fun bindDuel(duel: LiveDuelState?) {
        duelCardView?.isVisible = true
        if (duel == null) {
            duelMatchupView?.text = "You vs a matched rival"
            duelMetricView?.text = "Comments battle • Prize +12 YKC"
            duelYouScoreView?.text = "0"
            duelOpponentLabelView?.text = "Rival"
            duelOpponentScoreView?.text = "0"
            duelTimerView?.text = "⏱ 05:00 duel window"
            duelActionView?.text = "Start Duel"
            duelActionView?.alpha = 1f
            duelActionView?.setOnClickListener { createDuel("comment") }
            return
        }

        duelMatchupView?.text = "You vs ${duel.opponentName}"
        duelMetricView?.text = "${formatMetricLabel(duel.metricType)} battle • Prize +${duel.prizeYkc} YKC"
        duelYouScoreView?.text = duel.yourScore.toString()
        duelOpponentLabelView?.text = duel.opponentName
        duelOpponentScoreView?.text = duel.opponentScore.toString()
        duelTimerView?.text = when (duel.status) {
            "active" -> "⏱ ${formatDuration(duel.timeLeftSeconds)} left"
            "pending" -> if (duel.canJoin) "⏱ 05:00 duel window" else "Waiting for opponent"
            "completed" -> if ((duel.winner ?: "") == TokenManager.getUserId(fragment.requireContext()).orEmpty()) "🏆 You won this duel" else "🏁 Duel completed"
            else -> ""
        }

        duelActionView?.text = when {
            duel.canJoin -> "Join Duel"
            duel.status == "pending" -> "Waiting..."
            duel.status == "active" -> "Battle Live"
            else -> "Start Duel"
        }
        duelActionView?.alpha = if (duel.status == "pending" && !duel.canJoin) 0.72f else 1f
        duelActionView?.setOnClickListener {
            when {
                duel.canJoin -> joinDuel(duel.duelId)
                duel.status == "pending" -> Unit
                duel.status == "active" -> onQuickAction(metricToQuickAction(duel.metricType))
                else -> createDuel("comment")
            }
        }
    }

    private fun highlightRankChanges(
        sections: List<LiveLeaderboardSection>
    ): List<LiveLeaderboardSection> {
        val updatedRanks = sections.associate { section ->
            section.metricKey to (section.currentUser?.rank ?: 0)
        }

        val highlighted = sections.map { section ->
            val previousRank = currentUserRanks[section.metricKey] ?: 0
            val currentRank = section.currentUser?.rank ?: 0
            section.copy(
                highlightCurrentUser = previousRank > 0 && currentRank > 0 && previousRank != currentRank
            )
        }

        currentUserRanks = updatedRanks
        return highlighted
    }

    private fun buildResponseSignature(body: LiveMetricsResponse): String {
        return buildString {
            append(body.window)
            append('|')
            append(body.topCommenters.leaders.joinToString { "${it.userId}:${it.count}:${it.rank}" })
            append('|')
            append(body.topViews.leaders.joinToString { "${it.userId}:${it.count}:${it.rank}" })
            append('|')
            append(body.topConnectors.leaders.joinToString { "${it.userId}:${it.count}:${it.rank}" })
            append('|')
            append(body.topYKC.leaders.joinToString { "${it.userId}:${it.count}:${it.rank}" })
            append('|')
            append(body.events.joinToString())
        }
    }

    private fun startPolling() {
        stopPolling()
        pollRunnable = object : Runnable {
            override fun run() {
                if (liveDialog?.isShowing == true && hostResumed) {
                    fetchMetrics()
                    pollHandler.postDelayed(this, nextPollDelayMs)
                }
            }
        }.also {
            pollHandler.postDelayed(it, nextPollDelayMs)
        }
    }

    private fun stopPolling() {
        pollRunnable?.let { pollHandler.removeCallbacks(it) }
        pollRunnable = null
    }

    private fun showLoading() {
        loadingView?.isVisible = true
        errorView?.isVisible = false
        contentScroll?.isVisible = latestResponse != null
    }

    private fun showError(message: String) {
        loadingView?.isVisible = false
        errorTextView?.text = message
        errorView?.isVisible = true
        contentScroll?.isVisible = latestResponse != null
    }

    private fun hideLoadingAndError() {
        loadingView?.isVisible = false
        errorView?.isVisible = false
        contentScroll?.isVisible = true
    }

    private fun hideError() {
        errorView?.isVisible = false
    }

    private fun createDuel(metricType: String) {
        val context = fragment.context ?: return
        val token = TokenManager.getToken(context).orEmpty()
        if (token.isBlank()) return

        duelActionView?.isEnabled = false
        duelActionCall?.cancel()
        duelActionCall = ApiClient.apiService.createLiveDuel(
            "Bearer $token",
            mapOf("metricType" to metricType)
        )
        duelActionCall?.enqueue(object : Callback<LiveDuelEnvelope> {
            override fun onResponse(call: Call<LiveDuelEnvelope>, response: Response<LiveDuelEnvelope>) {
                duelActionView?.isEnabled = true
                val body = response.body()
                if (!response.isSuccessful) {
                    Toast.makeText(
                        context,
                        body?.error ?: "Could not start live duel.",
                        Toast.LENGTH_SHORT
                    ).show()
                    return
                }

                Toast.makeText(
                    context,
                    body?.message ?: "Live duel created.",
                    Toast.LENGTH_SHORT
                ).show()
                fetchMetrics(force = true)
            }

            override fun onFailure(call: Call<LiveDuelEnvelope>, t: Throwable) {
                if (call.isCanceled) return
                duelActionView?.isEnabled = true
                Toast.makeText(context, "Could not start live duel.", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun joinDuel(duelId: String) {
        val context = fragment.context ?: return
        val token = TokenManager.getToken(context).orEmpty()
        if (token.isBlank()) return

        duelActionView?.isEnabled = false
        duelActionCall?.cancel()
        duelActionCall = ApiClient.apiService.joinLiveDuel(
            "Bearer $token",
            mapOf("duelId" to duelId)
        )
        duelActionCall?.enqueue(object : Callback<LiveDuelEnvelope> {
            override fun onResponse(call: Call<LiveDuelEnvelope>, response: Response<LiveDuelEnvelope>) {
                duelActionView?.isEnabled = true
                val body = response.body()
                if (!response.isSuccessful) {
                    Toast.makeText(
                        context,
                        body?.error ?: "Could not join live duel.",
                        Toast.LENGTH_SHORT
                    ).show()
                    return
                }

                Toast.makeText(
                    context,
                    body?.message ?: "Live duel joined.",
                    Toast.LENGTH_SHORT
                ).show()
                fetchMetrics(force = true)
            }

            override fun onFailure(call: Call<LiveDuelEnvelope>, t: Throwable) {
                if (call.isCanceled) return
                duelActionView?.isEnabled = true
                Toast.makeText(context, "Could not join live duel.", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun formatMetricLabel(metricType: String?): String {
        return when (metricType?.lowercase()) {
            "comment", "comments" -> "Comments"
            "view", "views" -> "Views"
            "like", "likes" -> "Likes"
            else -> "Comments"
        }
    }

    private fun metricToQuickAction(metricType: String?): String {
        return when (metricType?.lowercase()) {
            "view", "views" -> "view"
            "like", "likes" -> "like"
            "follow", "follows" -> "follow"
            else -> "comment"
        }
    }

    private fun formatDuration(totalSeconds: Int): String {
        val safeSeconds = totalSeconds.coerceAtLeast(0)
        val minutes = safeSeconds / 60
        val seconds = safeSeconds % 60
        return "%02d:%02d".format(minutes, seconds)
    }

    private fun startPulse() {
        stopPulse()
        pulseRunnable = object : Runnable {
            override fun run() {
                fab?.let { button ->
                    AnimatorSet().apply {
                        playTogether(
                            ObjectAnimator.ofFloat(button, View.SCALE_X, 1f, 1.08f, 1f),
                            ObjectAnimator.ofFloat(button, View.SCALE_Y, 1f, 1.08f, 1f)
                        )
                        duration = 900L
                        start()
                    }
                }
                pulseHandler.postDelayed(this, 4000L)
            }
        }.also { pulseHandler.post(it) }
    }

    private fun stopPulse() {
        pulseRunnable?.let { pulseHandler.removeCallbacks(it) }
        pulseRunnable = null
    }

    private fun animateLiveDot(view: View) {
        view.animate().cancel()
        view.alpha = 1f
        view.animate()
            .alpha(0.35f)
            .setDuration(620L)
            .withEndAction {
                if (liveDialog?.isShowing == true) {
                    view.animate().alpha(1f).setDuration(620L).withEndAction {
                        if (liveDialog?.isShowing == true) animateLiveDot(view)
                    }.start()
                }
            }
            .start()
    }
}
