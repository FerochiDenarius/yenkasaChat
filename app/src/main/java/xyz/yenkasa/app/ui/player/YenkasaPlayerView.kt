package xyz.yenkasa.app.ui.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Rect
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.util.TypedValue
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.TouchDelegate
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.constraintlayout.widget.ConstraintLayout
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.isVisible
import androidx.core.view.updateLayoutParams
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.ui.feed.FeedTabsController
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserBadgeUtils
import xyz.yenkasa.app.util.WalletBalanceManager
import xyz.yenkasa.app.util.YenkasaMediaCache
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.abs

class YenkasaPlayerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : androidx.constraintlayout.widget.ConstraintLayout(context, attrs) {

    private val logoView: ImageView
    private val topBar: View
    private val searchBar: YenkasaSearchBarView
    private val feedTabsView: View
    private val communitiesPanel: View
    private val engagementRail: View
    private val menuButton: ImageButton
    private val seeAllButton: TextView
    private val communityStrip: YenkasaCommunityStrip
    private val walletPill: YenkasaWalletPill
    private val sponsoredAdButton: ImageButton
    private val liveArenaButton: YenkasaLiveArenaButton
    private val liveStreamButton: YenkasaLiveStreamButton
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
    private val buttonExpandActions: ImageButton
    private val secondaryActionsView: View
    private val textLike: TextView
    private val textViews: TextView
    private val textComment: TextView
    private val textShare: TextView
    private val textSave: TextView
    private val textReward: TextView
    private val textSponsoredAd: TextView
    private val feedModeTabs: List<TextView>

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
    private var secondaryActionsExpanded = false
    private var imageIndex = 0
    private var touchDownX = 0f
    private var touchDownY = 0f
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var muteChangedListener: (Boolean) -> Unit = {}
    private val firedCheckpoints = mutableSetOf<Int>()
    private val uiHandler = Handler(Looper.getMainLooper())
    private var playbackProgressListener: ((Int) -> Unit)? = null
    private var walletReceiverRegistered = false
    private var lastMonetizationSecond = -1

    private val autoHideRunnable = Runnable {
        if (isActiveItem && overlaysVisible) {
            overlaysVisible = false
            renderOverlayVisibility(animate = true)
        }
    }

    private val walletBalanceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WalletBalanceManager.ACTION_BALANCE_UPDATED) return
            val nextBalance = intent.getDoubleExtra(
                WalletBalanceManager.EXTRA_BALANCE_DOUBLE,
                TokenManager.getCoinsPrecise(this@YenkasaPlayerView.context)
            )
            val rewardAmount = intent.getDoubleExtra(WalletBalanceManager.EXTRA_REWARD_AMOUNT_DOUBLE, 0.0)
            if (rewardAmount > 0.0 && isShown) {
                walletPill.showRewardGain(nextBalance, rewardAmount)
            } else {
                walletPill.setBalance(nextBalance)
            }
        }
    }

    private val progressRunnable = object : Runnable {
        override fun run() {
            val currentPlayer = player ?: return
            controls.setProgress(currentPlayer.currentPosition, currentPlayer.duration)
            val checkpoint = (currentPlayer.currentPosition / 1000L).toInt()
            if (checkpoint in listOf(5, 10, 30) && firedCheckpoints.add(checkpoint)) {
                playbackProgressListener?.invoke(checkpoint)
            }
            if (checkpoint != lastMonetizationSecond) {
                lastMonetizationSecond = checkpoint
                boundPost?.let { post ->
                    val durationSeconds = (currentPlayer.duration / 1000L).toInt().coerceAtLeast(0)
                    actions?.onMonetizationProgress(post, checkpoint, durationSeconds)
                }
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
        feedTabsView = findViewById(R.id.scrollPlayerFeedTabs)
        communitiesPanel = findViewById(R.id.layoutPlayerCommunitiesPanel)
        engagementRail = findViewById(R.id.layoutPlayerEngagement)
        logoView = findViewById(R.id.imagePlayerLogo)
        menuButton = findViewById(R.id.buttonPlayerMenu)
        seeAllButton = findViewById(R.id.buttonPlayerSeeAllCommunities)
        communityStrip = findViewById(R.id.playerCommunityStrip)
        walletPill = findViewById(R.id.playerWalletPill)
        sponsoredAdButton = findViewById(R.id.playerSponsoredAdButton)
        liveArenaButton = findViewById(R.id.playerLiveArenaButton)
        liveStreamButton = findViewById(R.id.playerLiveStreamButton)
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
        buttonExpandActions = findViewById(R.id.buttonPlayerExpandActions)
        secondaryActionsView = findViewById(R.id.layoutPlayerSecondaryActions)
        textLike = findViewById(R.id.textPlayerLikeCount)
        textViews = findViewById(R.id.textPlayerViewCount)
        textComment = findViewById(R.id.textPlayerCommentCount)
        textShare = findViewById(R.id.textPlayerShareCount)
        textSave = findViewById(R.id.textPlayerSaveCount)
        textReward = findViewById(R.id.textPlayerRewardCount)
        textSponsoredAd = findViewById(R.id.textPlayerSponsoredAd)
        feedModeTabs = listOf(
            findViewById(R.id.tabForYou),
            findViewById(R.id.tabFollowing),
            findViewById(R.id.tabTrending),
            findViewById(R.id.tabLatest),
            findViewById(R.id.tabTop)
        )
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
        playerView.setOnClickListener { toggleOverlays() }
        audioArtworkView.setOnClickListener { toggleOverlays() }
        textView.setOnClickListener { toggleOverlays() }
        buttonExpandActions.setOnClickListener { toggleSecondaryActions() }
        setAccessibilityLabels()
        applyResponsiveSizing()
        applyEdgeToEdgeSpacing()
    }

    private fun applyEdgeToEdgeSpacing() {
        ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
            val safeBars = insets.getInsetsIgnoringVisibility(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            val side = dp(16)
            val topGap = dp(if (isCompactWidth()) 12 else 16)
            val controlsSide = dp(20)
            val controlsBottomGap = dp(36)

            topBar.updateMargins(
                start = safeBars.left + side,
                top = safeBars.top + topGap,
                end = safeBars.right + side
            )
            searchBar.updateMargins(start = safeBars.left + side)
            feedTabsView.updateMargins(
                start = safeBars.left + side,
                end = safeBars.right + dp(if (isCompactWidth()) 72 else 82)
            )
            communitiesPanel.updateMargins(
                end = safeBars.right + side
            )
            engagementRail.updateMargins(start = safeBars.left + side, bottom = safeBars.bottom + dp(110))
            moreOptionsButton.updateMargins(start = safeBars.left + side, bottom = dp(8))
            liveArenaButton.updateMargins(end = safeBars.right + side, bottom = safeBars.bottom + dp(72))
            liveStreamButton.updateMargins(end = safeBars.right + side, bottom = safeBars.bottom + dp(154))
            bottomMetaView.updateMargins(start = safeBars.left + side, end = safeBars.right + side, bottom = safeBars.bottom + dp(56))
            controlsView.updateMargins(
                start = safeBars.left + controlsSide,
                end = safeBars.right + controlsSide,
                bottom = safeBars.bottom + controlsBottomGap
            )
            engagementRail.post { protectEngagementRailFromFeedTabs() }
            insets
        }
        requestApplyInsetsWhenAttached()
    }

    private fun protectEngagementRailFromFeedTabs() {
        if (engagementRail.top == 0 || feedTabsView.bottom == 0) return

        val minimumTop = feedTabsView.bottom + dp(8)
        if (engagementRail.top >= minimumTop) return

        val overlap = minimumTop - engagementRail.top
        engagementRail.updateLayoutParams<ConstraintLayout.LayoutParams> {
            bottomMargin = (bottomMargin - overlap).coerceAtLeast(dp(8))
        }
    }

    private fun applyResponsiveSizing() {
        val compact = isCompactWidth()
        val shortHeight = isShortPlayerHeight()
        val railWidth = dp(if (compact) 46 else 50)
        val railHeight = dp(if (shortHeight) 230 else 260)
        val communityWidth = dp(if (compact) 52 else 58)
        val communityHeight = dp(if (compact) 188 else 246)
        val engagementButtonSize = dp(if (compact) 40 else 42)
        val engagementPadding = dp(if (compact) 10 else 11)

        engagementRail.updateLayoutParams<ConstraintLayout.LayoutParams> {
            width = railWidth
            height = railHeight
        }
        engagementRail.setPadding(
            engagementRail.paddingLeft,
            dp(if (compact) 3 else 4),
            engagementRail.paddingRight,
            dp(if (compact) 3 else 4)
        )
        secondaryActionsView.updateLayoutParams<ConstraintLayout.LayoutParams> {
            width = railWidth
        }
        communitiesPanel.updateLayoutParams<ConstraintLayout.LayoutParams> {
            width = communityWidth
        }
        communityStrip.updateLayoutParams<ViewGroup.LayoutParams> {
            height = communityHeight
        }

        listOf(
            buttonLike,
            buttonViews,
            buttonComment,
            buttonShare,
            buttonSave,
            sponsoredAdButton,
            buttonReward,
            buttonExpandActions
        ).forEach { button ->
            button.updateLayoutParams<ViewGroup.LayoutParams> {
                width = engagementButtonSize
                height = engagementButtonSize
            }
            button.setPadding(engagementPadding, engagementPadding, engagementPadding, engagementPadding)
            button.minimumWidth = 0
            button.minimumHeight = 0
        }

        logoView.updateLayoutParams<ViewGroup.LayoutParams> {
            width = dp(if (compact) 28 else 30)
            height = dp(if (compact) 28 else 30)
        }

        feedModeTabs.forEach { tab ->
            tab.setTextSize(TypedValue.COMPLEX_UNIT_SP, if (compact) 10f else 11f)
            tab.minHeight = dp(28)
        }
        listOf(textLike, textViews, textComment, textShare, textSave, textReward, textSponsoredAd).forEach { label ->
            label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 7f)
        }
        applyExpandedTouchTargets(
            listOf(
                buttonLike,
                buttonViews,
                buttonComment,
                buttonShare,
                buttonSave,
                sponsoredAdButton,
                buttonReward,
                buttonExpandActions
            ),
            dp(48)
        )

        if ((compact || shortHeight) && secondaryActionsExpanded) {
            collapseSecondaryActions(animate = false)
        }
    }

    private fun applyExpandedTouchTargets(buttons: List<View>, minTouchSize: Int) {
        buttons
            .mapNotNull { button -> (button.parent as? ViewGroup)?.let { parent -> parent to button } }
            .groupBy({ it.first }, { it.second })
            .forEach { (parent, children) ->
                parent.post {
                    val delegateGroup = MultiTouchDelegate(parent)
                    children.forEach { child ->
                        val rect = Rect()
                        child.getHitRect(rect)
                        val expandX = ((minTouchSize - rect.width()).coerceAtLeast(0)) / 2
                        val expandY = ((minTouchSize - rect.height()).coerceAtLeast(0)) / 2
                        rect.inset(-expandX, -expandY)
                        delegateGroup.addDelegate(TouchDelegate(rect, child))
                    }
                    parent.touchDelegate = delegateGroup
                }
            }
    }

    private class MultiTouchDelegate(parent: View) : TouchDelegate(Rect(), parent) {
        private val delegates = mutableListOf<TouchDelegate>()

        fun addDelegate(delegate: TouchDelegate) {
            delegates += delegate
        }

        override fun onTouchEvent(event: MotionEvent): Boolean {
            return delegates.any { it.onTouchEvent(event) }
        }
    }

    private fun setAccessibilityLabels() {
        menuButton.contentDescription = context.getString(R.string.open_menu)
        walletPill.contentDescription = context.getString(R.string.feed_wallet_open)
        searchBar.contentDescription = context.getString(R.string.search_posts)
        seeAllButton.contentDescription = context.getString(R.string.show_all_communities)
        buttonLike.contentDescription = context.getString(R.string.like_post)
        buttonViews.contentDescription = context.getString(R.string.view_count)
        buttonComment.contentDescription = context.getString(R.string.open_comments)
        buttonShare.contentDescription = context.getString(R.string.share_post)
        buttonSave.contentDescription = context.getString(R.string.save_post)
        sponsoredAdButton.contentDescription = context.getString(R.string.create_sponsored_ad)
        buttonReward.contentDescription = context.getString(R.string.reward_creator)
        buttonExpandActions.contentDescription = context.getString(R.string.show_more_actions)
        moreOptionsButton.contentDescription = context.getString(R.string.more_post_options)
        liveArenaButton.contentDescription = context.getString(R.string.open_live_arena)
        liveStreamButton.contentDescription = context.getString(R.string.browse_live_streams)
        avatarView.contentDescription = context.getString(R.string.open_creator_profile)
        usernameView.contentDescription = context.getString(R.string.open_creator_profile)
    }

    private fun toggleSecondaryActions() {
        if (isCompactWidth() || isShortPlayerHeight()) {
            collapseSecondaryActions(animate = true)
            return
        }
        secondaryActionsExpanded = !secondaryActionsExpanded
        secondaryActionsView.animate().cancel()
        buttonExpandActions.animate().cancel()
        if (secondaryActionsExpanded) {
            secondaryActionsView.alpha = 0f
            secondaryActionsView.isVisible = true
            secondaryActionsView.animate().alpha(1f).setDuration(180L).start()
            buttonExpandActions.animate().rotation(180f).setDuration(180L).start()
            buttonExpandActions.contentDescription = context.getString(R.string.hide_more_actions)
        } else {
            secondaryActionsView.animate()
                .alpha(0f)
                .setDuration(160L)
                .withEndAction { secondaryActionsView.isVisible = false }
                .start()
            buttonExpandActions.animate().rotation(0f).setDuration(180L).start()
            buttonExpandActions.contentDescription = context.getString(R.string.show_more_actions)
        }
        scheduleAutoHide()
    }

    private fun collapseSecondaryActions(animate: Boolean) {
        secondaryActionsExpanded = false
        secondaryActionsView.animate().cancel()
        buttonExpandActions.animate().cancel()
        buttonExpandActions.contentDescription = context.getString(R.string.show_more_actions)
        if (animate) {
            secondaryActionsView.animate()
                .alpha(0f)
                .setDuration(160L)
                .withEndAction { secondaryActionsView.isVisible = false }
                .start()
            buttonExpandActions.animate().rotation(0f).setDuration(180L).start()
        } else {
            secondaryActionsView.alpha = 0f
            secondaryActionsView.isVisible = false
            buttonExpandActions.rotation = 0f
        }
        scheduleAutoHide()
    }

    private fun scheduleAutoHide() {
        uiHandler.removeCallbacks(autoHideRunnable)
        if (isActiveItem && overlaysVisible) {
            uiHandler.postDelayed(autoHideRunnable, 3_000L)
        }
    }

    private fun setOverlayInteractable(view: View, enabled: Boolean) {
        view.isEnabled = enabled
        view.importantForAccessibility = if (enabled) {
            View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
        } else {
            View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }
        if (view is ViewGroup) {
            for (index in 0 until view.childCount) {
                setOverlayInteractable(view.getChildAt(index), enabled)
            }
        }
    }

    private fun requestApplyInsetsWhenAttached() {
        if (isAttachedToWindow) {
            ViewCompat.requestApplyInsets(this)
            return
        }
        addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                removeOnAttachStateChangeListener(this)
                ViewCompat.requestApplyInsets(v)
            }

            override fun onViewDetachedFromWindow(v: View) = Unit
        })
    }

    private fun isCompactWidth(): Boolean {
        return resources.configuration.screenWidthDp in 1..359
    }

    private fun isShortPlayerHeight(): Boolean {
        return resources.configuration.screenHeightDp in 1..699
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun View.updateMargins(
        start: Int? = null,
        top: Int? = null,
        end: Int? = null,
        bottom: Int? = null
    ) {
        updateLayoutParams<ViewGroup.MarginLayoutParams> {
            start?.let { marginStart = it }
            top?.let { topMargin = it }
            end?.let { marginEnd = it }
            bottom?.let { bottomMargin = it }
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (!walletReceiverRegistered) {
            ContextCompat.registerReceiver(
                context,
                walletBalanceReceiver,
                IntentFilter(WalletBalanceManager.ACTION_BALANCE_UPDATED),
                RECEIVER_NOT_EXPORTED
            )
            walletReceiverRegistered = true
        }
    }

    override fun onDetachedFromWindow() {
        if (walletReceiverRegistered) {
            runCatching { context.unregisterReceiver(walletBalanceReceiver) }
            walletReceiverRegistered = false
        }
        uiHandler.removeCallbacks(autoHideRunnable)
        uiHandler.removeCallbacks(progressRunnable)
        super.onDetachedFromWindow()
    }

    override fun onConfigurationChanged(newConfig: Configuration?) {
        super.onConfigurationChanged(newConfig)
        applyResponsiveSizing()
        requestApplyInsetsWhenAttached()
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
            if (!overlaysVisible) {
                overlaysVisible = true
                renderOverlayVisibility(animate = true)
                scheduleAutoHide()
                return true
            }
            scheduleAutoHide()
        }
        return super.dispatchTouchEvent(ev)
    }

    fun bind(
        post: Post,
        item: YenkasaPlayerItem,
        communities: List<Community>,
        selectedCommunityIds: Set<String>,
        saved: Boolean,
        position: Int,
        sourcePostPosition: Int = position,
        selectedFeedMode: FeedTabsController.FeedMode,
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
        secondaryActionsExpanded = false
        imageIndex = 0
        firedCheckpoints.clear()
        lastMonetizationSecond = -1
        secondaryActionsView.alpha = 0f
        secondaryActionsView.isVisible = false
        buttonExpandActions.rotation = 0f
        buttonExpandActions.contentDescription = context.getString(R.string.show_more_actions)

        walletPill.setBalance(item.walletBalance)
        liveStreamButton.isVisible = true
        searchBar.reset()
        searchBar.setOnQueryChanged { query -> actions.onSearchQuery(query) }
        bindFeedModeTabs(selectedFeedMode, actions)
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
        liveStreamButton.setOnClickListener { actions.onOpenLiveStream() }
        avatarView.setOnClickListener { actions.onOpenProfile(post.userId.id) }
        usernameView.setOnClickListener { actions.onOpenProfile(post.userId.id) }
        moreOptionsButton.setOnClickListener { actions.onShowPostOptions(post) }

        usernameView.text = item.username
        captionView.text = item.caption.orEmpty()
        captionView.isVisible = !item.caption.isNullOrBlank()
        sourceView.text = formatSourceLine(item)

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
        textReward.text = if (item.rewardAmount > 0) {
            context.getString(R.string.ykc_reward_gain, item.rewardAmount.toString())
        } else {
            context.getString(R.string.reward)
        }

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
        scheduleAutoHide()
        setActive(isActiveItem)
    }

    fun setActive(active: Boolean) {
        isActiveItem = active
        val item = boundItem ?: return
        if (active) {
            scheduleAutoHide()
            when (item.mediaType) {
                MediaType.VIDEO, MediaType.AUDIO -> prepareAndPlay(item)
                else -> releasePlayer()
            }
        } else {
            uiHandler.removeCallbacks(autoHideRunnable)
            pausePlayback()
        }
    }

    private fun formatSourceLine(item: YenkasaPlayerItem): String {
        val time = formatTimestamp(item.createdAt)
        val source = item.audioTitle ?: item.communityName ?: context.getString(R.string.original_sound_yenkasa)
        return if (time.isBlank()) source else "$source ${context.getString(R.string.bullet_separator)} $time"
    }

    private fun formatTimestamp(rawTimestamp: String?): String {
        val timestamp = parseTimestampMillis(rawTimestamp) ?: return context.getString(R.string.time_now_short)
        val diffMillis = System.currentTimeMillis() - timestamp
        val diffSeconds = diffMillis / 1000

        return when {
            diffSeconds < 60 -> context.getString(R.string.time_now_short)
            diffSeconds < 3600 -> context.getString(R.string.time_minutes_short, diffSeconds / 60)
            diffSeconds < 86400 -> context.getString(R.string.time_hours_short, diffSeconds / 3600)
            diffSeconds < 604800 -> context.getString(R.string.time_days_short, diffSeconds / 86400)
            else -> SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(Date(timestamp))
        }
    }

    private fun parseTimestampMillis(rawTimestamp: String?): Long? {
        if (rawTimestamp.isNullOrBlank()) return null

        rawTimestamp.toLongOrNull()?.let { value ->
            return if (value < 10_000_000_000L) value * 1000 else value
        }

        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX"
        )

        return formats.firstNotNullOfOrNull { pattern ->
            runCatching {
                SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.parse(rawTimestamp)?.time
            }.getOrNull()
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
        uiHandler.removeCallbacks(autoHideRunnable)
        releasePlayer()
        lastMonetizationSecond = -1
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
        if (overlaysVisible) {
            scheduleAutoHide()
        } else {
            uiHandler.removeCallbacks(autoHideRunnable)
        }
    }

    private fun renderOverlayVisibility(animate: Boolean) {
        listOf(
            topBar,
            searchBar,
            feedTabsView,
            communitiesPanel,
            engagementRail,
            moreOptionsButton,
            bottomMetaView,
            controlsView,
            walletPill,
            liveArenaButton,
            liveStreamButton
        ).forEach { view ->
            view.animate().cancel()
            setOverlayInteractable(view, overlaysVisible)
            view.isVisible = true
            if (animate) {
                if (overlaysVisible) {
                    view.animate().alpha(1f).setDuration(180L).start()
                } else {
                    view.animate().alpha(0f).setDuration(180L).start()
                }
            } else {
                view.alpha = if (overlaysVisible) 1f else 0f
            }
        }
    }

    private fun bindFeedModeTabs(
        selectedMode: FeedTabsController.FeedMode,
        actions: YenkasaPlayerActions
    ) {
        feedModeTabs.forEach { tab ->
            val mode = when (tab.id) {
                R.id.tabFollowing -> FeedTabsController.FeedMode.FOLLOWING
                R.id.tabTrending -> FeedTabsController.FeedMode.TRENDING
                R.id.tabLatest -> FeedTabsController.FeedMode.LATEST
                R.id.tabTop -> FeedTabsController.FeedMode.TOP
                else -> FeedTabsController.FeedMode.FOR_YOU
            }
            val selected = mode == selectedMode
            tab.setBackgroundResource(
                if (selected) R.drawable.bg_yenkasa_player_chip_selected
                else R.drawable.bg_yenkasa_player_chip
            )
            tab.setTextColor(Color.WHITE)
            tab.setTypeface(tab.typeface, if (selected) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
            tab.alpha = if (selected) 1f else 0.78f
            tab.setOnClickListener {
                if (mode != selectedMode) {
                    actions.onFeedModeSelected(mode)
                }
            }
        }
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
                val mediaItem = MediaItem.fromUri(Uri.parse(mediaUrl))
                exo.setMediaSource(YenkasaMediaCache.mediaSource(context, mediaItem))
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
