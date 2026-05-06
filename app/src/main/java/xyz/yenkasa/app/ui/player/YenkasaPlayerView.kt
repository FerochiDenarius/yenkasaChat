package xyz.yenkasa.app.ui.player

import android.content.Context
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.UserBadgeUtils
import kotlin.math.abs

class YenkasaPlayerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : androidx.constraintlayout.widget.ConstraintLayout(context, attrs) {

    private val logoView: ImageView
    private val topBar: View
    private val searchBar: YenkasaSearchBarView
    private val communitiesPanel: View
    private val engagementRail: View
    private val menuButton: ImageButton
    private val seeAllButton: TextView
    private val communityStrip: YenkasaCommunityStrip
    private val walletPill: YenkasaWalletPill
    private val sponsoredAdButton: ImageButton
    private val liveArenaButton: YenkasaLiveArenaButton
    private val playerView: PlayerView
    private val imageView: ImageView
    private val audioArtworkView: ImageView
    private val textView: TextView
    private val avatarView: ImageView
    private val usernameView: TextView
    private val verifiedBadgeView: ImageView
    private val captionView: TextView
    private val sourceView: TextView
    private val moreOptionsButton: ImageButton
    private val controls: YenkasaPlayerControls
    private val controlsView: View
    private val bottomMetaView: View
    private val buttonLike: ImageButton
    private val buttonViews: ImageButton
    private val buttonComment: ImageButton
    private val buttonShare: ImageButton
    private val buttonSave: ImageButton
    private val buttonReward: ImageButton
    private val textLike: TextView
    private val textViews: TextView
    private val textComment: TextView
    private val textShare: TextView
    private val textSave: TextView
    private val textReward: TextView

    private var boundPost: Post? = null
    private var boundItem: YenkasaPlayerItem? = null
    private var actions: YenkasaPlayerActions? = null
    private var adapterPositionValue: Int = -1
    private var player: ExoPlayer? = null
    private var isMuted = false
    private var isActiveItem = false
    private var currentMediaUrl: String? = null
    private var saveSelected = false
    private var likeSelected = false
    private var overlaysVisible = true
    private var imageIndex = 0
    private var touchDownX = 0f
    private var touchDownY = 0f
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var muteChangedListener: (Boolean) -> Unit = {}
    private val firedCheckpoints = mutableSetOf<Int>()
    private val uiHandler = Handler(Looper.getMainLooper())
    private var playbackProgressListener: ((Int) -> Unit)? = null

    private val progressRunnable = object : Runnable {
        override fun run() {
            val currentPlayer = player ?: return
            controls.setProgress(currentPlayer.currentPosition, currentPlayer.duration)
            val checkpoint = (currentPlayer.currentPosition / 1000L).toInt()
            if (checkpoint in listOf(5, 10, 30) && firedCheckpoints.add(checkpoint)) {
                playbackProgressListener?.invoke(checkpoint)
            }
            if (currentPlayer.isPlaying) {
                uiHandler.postDelayed(this, 300L)
            }
        }
    }

    init {
        LayoutInflater.from(context).inflate(R.layout.view_yenkasa_player, this, true)
        topBar = findViewById(R.id.layoutPlayerTopBar)
        searchBar = findViewById(R.id.playerSearchBar)
        communitiesPanel = findViewById(R.id.layoutPlayerCommunitiesPanel)
        engagementRail = findViewById(R.id.layoutPlayerEngagement)
        logoView = findViewById(R.id.imagePlayerLogo)
        menuButton = findViewById(R.id.buttonPlayerMenu)
        seeAllButton = findViewById(R.id.buttonPlayerSeeAllCommunities)
        communityStrip = findViewById(R.id.playerCommunityStrip)
        walletPill = findViewById(R.id.playerWalletPill)
        sponsoredAdButton = findViewById(R.id.playerSponsoredAdButton)
        liveArenaButton = findViewById(R.id.playerLiveArenaButton)
        playerView = findViewById(R.id.playerMediaView)
        imageView = findViewById(R.id.imagePlayerMedia)
        audioArtworkView = findViewById(R.id.imageAudioArtwork)
        textView = findViewById(R.id.textPlayerContent)
        avatarView = findViewById(R.id.imagePlayerAvatar)
        usernameView = findViewById(R.id.textPlayerUsername)
        verifiedBadgeView = findViewById(R.id.imagePlayerVerified)
        captionView = findViewById(R.id.textPlayerCaption)
        sourceView = findViewById(R.id.textPlayerSource)
        moreOptionsButton = findViewById(R.id.buttonPlayerMoreOptions)
        buttonLike = findViewById(R.id.buttonPlayerLike)
        buttonViews = findViewById(R.id.buttonPlayerViews)
        buttonComment = findViewById(R.id.buttonPlayerComment)
        buttonShare = findViewById(R.id.buttonPlayerShare)
        buttonSave = findViewById(R.id.buttonPlayerSave)
        buttonReward = findViewById(R.id.buttonPlayerReward)
        textLike = findViewById(R.id.textPlayerLikeCount)
        textViews = findViewById(R.id.textPlayerViewCount)
        textComment = findViewById(R.id.textPlayerCommentCount)
        textShare = findViewById(R.id.textPlayerShareCount)
        textSave = findViewById(R.id.textPlayerSaveCount)
        textReward = findViewById(R.id.textPlayerRewardCount)
        bottomMetaView = findViewById(R.id.layoutPlayerBottomMeta)
        controlsView = findViewById(R.id.layoutPlayerControls)
        controls = YenkasaPlayerControls(this)

        logoView.setImageResource(R.drawable.ic_yenkasa_logo)
        playerView.useController = false
        playerView.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        controls.setCallbacks(
            onPrevious = { actions?.onNavigateTo(adapterPositionValue - 1) },
            onPlayPause = { togglePlayback() },
            onNext = { actions?.onNavigateTo(adapterPositionValue + 1) },
            onMute = { toggleMute() },
            onSeek = { progress ->
                player?.duration?.takeIf { it > 0 }?.let { duration ->
                    player?.seekTo((duration * progress) / 1000L)
                }
            }
        )
        imageView.setOnTouchListener { _, event -> handleImageTouch(event) }
    }

    fun bind(
        post: Post,
        item: YenkasaPlayerItem,
        communities: List<Community>,
        selectedCommunityIds: Set<String>,
        saved: Boolean,
        position: Int,
        sourcePostPosition: Int = position,
        actions: YenkasaPlayerActions,
        initialMuted: Boolean,
        onMuteChanged: (Boolean) -> Unit,
        onPlaybackCheckpoint: (Int) -> Unit
    ) {
        boundPost = post
        boundItem = item
        this.actions = actions
        adapterPositionValue = position
        playbackProgressListener = onPlaybackCheckpoint
        muteChangedListener = onMuteChanged
        isMuted = initialMuted
        saveSelected = saved
        likeSelected = post.likedByUser
        overlaysVisible = true
        imageIndex = 0
        firedCheckpoints.clear()

        walletPill.setBalance(item.walletBalance)
        searchBar.reset()
        searchBar.setOnQueryChanged { query -> actions.onSearchQuery(query) }
        communityStrip.submit(
            communities = communities,
            selectedIds = selectedCommunityIds,
            onAllSelected = { actions.onCommunitySelected(null) },
            onCommunitySelected = { community -> actions.onCommunitySelected(community) }
        )

        seeAllButton.setOnClickListener { actions.onSeeAllCommunities() }
        menuButton.setOnClickListener { actions.onOpenMenu() }
        walletPill.setOnClickListener { actions.onOpenWallet() }
        sponsoredAdButton.setOnClickListener { actions.onCreateSponsoredAd() }
        liveArenaButton.setOnClickListener { actions.onOpenLiveArena() }
        avatarView.setOnClickListener { actions.onOpenProfile(post.userId.id) }
        usernameView.setOnClickListener { actions.onOpenProfile(post.userId.id) }
        moreOptionsButton.setOnClickListener { actions.onShowPostOptions(post) }

        usernameView.text = item.username
        captionView.text = item.caption.orEmpty()
        captionView.isVisible = !item.caption.isNullOrBlank()
        sourceView.text = item.audioTitle ?: item.communityName ?: "Original Sound - Yenkasa"

        UserBadgeUtils.applyBadge(verifiedBadgeView, item.isVerified, post.userId.roleName)
        Glide.with(context)
            .load(item.userAvatarUrl)
            .placeholder(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(avatarView)

        updateCount(textLike, formatCount(item.likeCount))
        updateCount(textViews, formatCount(item.viewCount))
        textComment.text = formatCount(item.commentCount)
        textShare.text = formatCount(item.shareCount)
        textSave.text = formatCount(item.saveCount + if (saved) 1 else 0)
        textReward.text = if (item.rewardAmount > 0) "+${item.rewardAmount} YKC" else "Reward"

        renderLikeState()
        buttonLike.setOnClickListener {
            likeSelected = !likeSelected
            renderLikeState(animate = true)
            actions.onLike(post, sourcePostPosition)
        }
        buttonViews.setOnClickListener { }
        buttonComment.setOnClickListener { actions.onComment(post, sourcePostPosition) }
        buttonShare.setOnClickListener { actions.onShare(post) }
        buttonSave.setOnClickListener {
            saveSelected = !saveSelected
            textSave.text = formatCount(item.saveCount + if (saveSelected) 1 else 0)
            buttonSave.alpha = if (saveSelected) 1f else 0.82f
            actions.onSave(post, saveSelected)
        }
        buttonReward.setOnClickListener { actions.onReward(post) }
        buttonSave.alpha = if (saveSelected) 1f else 0.82f

        controls.bindMediaType(item.mediaType)
        controls.setMuted(isMuted)
        renderMedia(item)
        renderOverlayVisibility(animate = false)
        setActive(isActiveItem)
    }

    fun setActive(active: Boolean) {
        isActiveItem = active
        val item = boundItem ?: return
        if (active) {
            when (item.mediaType) {
                MediaType.VIDEO, MediaType.AUDIO -> prepareAndPlay(item)
                else -> releasePlayer()
            }
        } else {
            pausePlayback()
        }
    }

    fun onHostPause() {
        pausePlayback()
    }

    fun onHostResume() {
        if (isActiveItem) {
            boundItem?.let {
                if (it.mediaType == MediaType.VIDEO || it.mediaType == MediaType.AUDIO) {
                    prepareAndPlay(it)
                }
            }
        }
    }

    fun release() {
        uiHandler.removeCallbacks(progressRunnable)
        releasePlayer()
    }

    private fun renderMedia(item: YenkasaPlayerItem) {
        imageView.isVisible = false
        audioArtworkView.isVisible = false
        textView.isVisible = false
        playerView.isVisible = false

        when (item.mediaType) {
            MediaType.VIDEO -> {
                playerView.isVisible = true
                imageView.isVisible = false
                item.thumbnailUrl?.let { url ->
                    Glide.with(context).load(url).into(imageView)
                }
            }

            MediaType.IMAGE -> {
                imageView.isVisible = true
                loadImageAt(imageIndex)
            }

            MediaType.TEXT -> {
                textView.isVisible = true
                textView.text = item.textContent.orEmpty()
                applyTextPresentation(item)
            }

            MediaType.AUDIO -> {
                audioArtworkView.isVisible = true
                Glide.with(context)
                    .load(item.thumbnailUrl)
                    .placeholder(R.drawable.ic_yenkasa_logo)
                    .error(R.drawable.ic_yenkasa_logo)
                    .into(audioArtworkView)
            }
        }
    }

    private fun handleImageTouch(event: MotionEvent): Boolean {
        val item = boundItem ?: return false
        if (item.mediaType != MediaType.IMAGE) return false

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                touchDownX = event.x
                touchDownY = event.y
                parent?.requestDisallowInterceptTouchEvent(false)
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - touchDownX
                val dy = event.y - touchDownY
                if (abs(dx) > touchSlop && abs(dx) > abs(dy)) {
                    parent?.requestDisallowInterceptTouchEvent(true)
                } else if (abs(dy) > touchSlop && abs(dy) > abs(dx)) {
                    parent?.requestDisallowInterceptTouchEvent(false)
                }
                return true
            }

            MotionEvent.ACTION_UP -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                val dx = event.x - touchDownX
                val dy = event.y - touchDownY
                when {
                    abs(dx) > 64f && abs(dx) > abs(dy) -> {
                        if (dx < 0) showNextImage() else showPreviousImage()
                    }
                    abs(dx) < touchSlop && abs(dy) < touchSlop -> {
                        toggleOverlays()
                    }
                }
                return true
            }

            MotionEvent.ACTION_CANCEL -> {
                parent?.requestDisallowInterceptTouchEvent(false)
                return true
            }
        }
        return false
    }

    private fun showNextImage() {
        val images = boundItem?.imageUrls.orEmpty()
        if (images.size <= 1) return
        imageIndex = (imageIndex + 1).coerceAtMost(images.lastIndex)
        loadImageAt(imageIndex)
    }

    private fun showPreviousImage() {
        val images = boundItem?.imageUrls.orEmpty()
        if (images.size <= 1) return
        imageIndex = (imageIndex - 1).coerceAtLeast(0)
        loadImageAt(imageIndex)
    }

    private fun loadImageAt(index: Int) {
        val item = boundItem ?: return
        val images = item.imageUrls
        val imageUrl = images.getOrNull(index) ?: item.mediaUrl ?: item.thumbnailUrl
        Glide.with(context)
            .load(imageUrl)
            .placeholder(R.drawable.ic_yenkasa_logo)
            .error(R.drawable.ic_yenkasa_logo)
            .into(imageView)
    }

    private fun toggleOverlays() {
        overlaysVisible = !overlaysVisible
        renderOverlayVisibility(animate = true)
    }

    private fun renderOverlayVisibility(animate: Boolean) {
        listOf(
            topBar,
            searchBar,
            communitiesPanel,
            engagementRail,
            moreOptionsButton,
            bottomMetaView,
            controlsView,
            walletPill,
            sponsoredAdButton
        ).forEach { view ->
            view.animate().cancel()
            if (animate) {
                if (overlaysVisible) {
                    view.isVisible = true
                    view.alpha = 0f
                    view.animate().alpha(1f).setDuration(130L).start()
                } else {
                    view.animate().alpha(0f).setDuration(110L).withEndAction {
                        view.isVisible = false
                    }.start()
                }
            } else {
                view.alpha = if (overlaysVisible) 1f else 0f
                view.isVisible = overlaysVisible
            }
        }
        liveArenaButton.isVisible = true
        liveArenaButton.alpha = 1f
    }

    private fun applyTextPresentation(item: YenkasaPlayerItem) {
        if (!item.textBackgroundImageUrl.isNullOrBlank()) {
            imageView.isVisible = true
            Glide.with(context)
                .load(item.textBackgroundImageUrl)
                .placeholder(R.drawable.ic_yenkasa_logo)
                .error(R.drawable.ic_yenkasa_logo)
                .into(imageView)
            textView.setBackgroundColor(Color.TRANSPARENT)
            textView.setTextColor(Color.WHITE)
            return
        }

        val hasSelectedColor = !item.textBackgroundColor.isNullOrBlank()
        if (hasSelectedColor) {
            TextPostBackgrounds.apply(textView, item.textBackgroundColor.orEmpty(), centered = true)
            return
        }

        val isNightMode =
            resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        textView.setBackgroundColor(
            if (isNightMode) ContextCompat.getColor(context, R.color.yenkasa_emerald)
            else ContextCompat.getColor(context, android.R.color.white)
        )
        textView.setTextColor(
            if (isNightMode) Color.WHITE else ContextCompat.getColor(context, R.color.feed_primary_text)
        )
    }

    private fun prepareAndPlay(item: YenkasaPlayerItem) {
        val mediaUrl = item.mediaUrl ?: return
        if (currentMediaUrl != mediaUrl || player == null) {
            releasePlayer()
            currentMediaUrl = mediaUrl
            player = ExoPlayer.Builder(context).build().also { exo ->
                exo.repeatMode = Player.REPEAT_MODE_OFF
                exo.setMediaItem(MediaItem.fromUri(Uri.parse(mediaUrl)))
                exo.prepare()
                exo.addListener(object : Player.Listener {
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        controls.setPlaying(isPlaying)
                        if (isPlaying) {
                            uiHandler.removeCallbacks(progressRunnable)
                            uiHandler.post(progressRunnable)
                        } else {
                            uiHandler.removeCallbacks(progressRunnable)
                        }
                    }
                })
                playerView.player = exo
            }
        }

        playerView.isVisible = item.mediaType == MediaType.VIDEO
        if (item.mediaType == MediaType.AUDIO) {
            audioArtworkView.isVisible = true
        }

        player?.playWhenReady = true
        player?.play()
        controls.setMuted(isMuted)
        applyMute()
    }

    private fun togglePlayback() {
        val currentPlayer = player ?: return
        if (currentPlayer.isPlaying) {
            currentPlayer.pause()
        } else {
            currentPlayer.play()
        }
    }

    private fun toggleMute() {
        isMuted = !isMuted
        applyMute()
        controls.setMuted(isMuted)
        boundItem?.let {
            if (it.mediaType == MediaType.VIDEO || it.mediaType == MediaType.AUDIO) {
                muteChangedListener(isMuted)
            }
        }
    }

    private fun applyMute() {
        player?.volume = if (isMuted) 0f else 1f
    }

    private fun pausePlayback() {
        player?.pause()
        uiHandler.removeCallbacks(progressRunnable)
    }

    private fun releasePlayer() {
        uiHandler.removeCallbacks(progressRunnable)
        playerView.player = null
        player?.release()
        player = null
        currentMediaUrl = null
        controls.setPlaying(false)
        controls.setProgress(0L, 0L)
    }

    private fun formatCount(value: Int): String {
        return when {
            value >= 1_000_000 -> String.format("%.1fM", value / 1_000_000f)
            value >= 1_000 -> String.format("%.1fK", value / 1_000f)
            value <= 0 -> "0"
            else -> value.toString()
        }
    }

    private fun renderLikeState(animate: Boolean = false) {
        val accent = ContextCompat.getColor(context, R.color.wallet_accent_green)
        val inactive = ContextCompat.getColor(context, android.R.color.white)
        buttonLike.setImageResource(if (likeSelected) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline)
        buttonLike.setColorFilter(if (likeSelected) accent else inactive)
        textLike.setTextColor(if (likeSelected) accent else inactive)
        if (animate) {
            buttonLike.animate().cancel()
            buttonLike.scaleX = 0.86f
            buttonLike.scaleY = 0.86f
            buttonLike.animate().scaleX(1f).scaleY(1f).setDuration(140L).start()
        }
    }

    private fun updateCount(view: TextView, nextValue: String) {
        if (view.text?.toString() == nextValue) return
        view.text = nextValue
        view.animate().cancel()
        view.alpha = 0.72f
        view.scaleX = 0.92f
        view.scaleY = 0.92f
        view.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(160L).start()
    }
}
