package xyz.yenkasa.app.adapter

import android.content.Context
import android.content.res.ColorStateList
import android.net.Uri
import android.os.Handler
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.media3.common.Player
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import androidx.viewpager2.widget.ViewPager2
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.FollowResponse
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.ViewRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*
import kotlin.concurrent.scheduleAtFixedRate

class PostAdapter(
    private val context: Context,
    private var posts: List<Post>,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post, Int) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit,
    private val onShareClick: (Post) -> Unit,
    private val onViewCountUpdated: (String, Int) -> Unit = { _, _ -> }

) : RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    // Single ExoPlayer for all video playback
    private var exoPlayer: ExoPlayer? = null
    private var currentPlayingPosition: Int = -1
    private var currentPlayerView: PlayerView? = null

    private val lastViewTime = mutableMapOf<String, Long>()
    private var videoTimer: Timer? = null
    private var videoSeconds = 0

    // Prevent double-prep/tap races
    private var isPreparing = false

    // Optional external callbacks
    private var onDeleteClickListener: ((Post) -> Unit)? = null
    private var onHideClickListener: ((Post) -> Unit)? = null
    private var onDownloadClickListener: ((Post) -> Unit)? = null
    private var onFlagClickListener: ((Post) -> Unit)? = null



    fun setOnDeleteClickListener(listener: (Post) -> Unit) { onDeleteClickListener = listener }
    fun setOnHideClickListener(listener: (Post) -> Unit) { onHideClickListener = listener }
    fun setOnDownloadClickListener(listener: (Post) -> Unit) { onDownloadClickListener = listener }
    fun setOnFlagClickListener(listener: (Post) -> Unit) { onFlagClickListener = listener }

    inner class PostViewHolder(val itemRoot: View) : RecyclerView.ViewHolder(itemRoot) {
        // Header
        val profileImage: ImageView = itemRoot.findViewById(R.id.imageProfilePost)
        val username: TextView = itemRoot.findViewById(R.id.textUsernamePost)
        val verifiedBadge: ImageView = itemRoot.findViewById(R.id.imageVerifiedBadge)
        val timestamp: TextView = itemRoot.findViewById(R.id.textTimestampPost)
        val communityName: TextView = itemRoot.findViewById(R.id.textCommunityName)
        val postText: TextView = itemRoot.findViewById(R.id.textPostContent)
        val mediaContainer: FrameLayout = itemRoot.findViewById(R.id.mediaContainer)
        val textBackgroundPost: TextView = itemRoot.findViewById(R.id.textPostBackgroundContent)

        // Engagement
        val btnLike: ImageButton = itemRoot.findViewById(R.id.btnLike)
        val btnComment: ImageButton = itemRoot.findViewById(R.id.btnComment)
        val btnShare: ImageButton = itemRoot.findViewById(R.id.btnShare)
        val likeCount: TextView = itemRoot.findViewById(R.id.textLikeCount)
        val commentCount: TextView = itemRoot.findViewById(R.id.textCommentCount)
        val coinsEarned: TextView = itemRoot.findViewById(R.id.textCoinsEarned)
        val viewCount: TextView = itemRoot.findViewById(R.id.textViewCount)
        val fabFollow: FloatingActionButton = itemRoot.findViewById(R.id.fabFollow)

        // IMAGE
        val postImage: ImageView = itemRoot.findViewById(R.id.imagePostContent)
        val imageCarousel: ViewPager2 = itemRoot.findViewById(R.id.imageCarouselPostContent)
        val imageCarouselCounter: TextView = itemRoot.findViewById(R.id.textImageCarouselCounter)
        private var imagePageCallback: ViewPager2.OnPageChangeCallback? = null

        // VIDEO
        val playerView: PlayerView? = itemRoot.findViewById(R.id.playerView)
        val imageVideoThumbnail: ImageView = itemRoot.findViewById(R.id.imageVideoThumbnail)
        val btnVideoPlay: ImageButton = itemRoot.findViewById(R.id.btnVideoPlay)
        val btnPlayPause: ImageButton? = itemRoot.findViewById(R.id.btnPlayPause)

        // AUDIO
        val audioIcon: LinearLayout = itemRoot.findViewById(R.id.audioIcon)
        val btnAudioPlayPause: ImageButton = itemRoot.findViewById(R.id.btnAudioPlayPause)
        val audioSeekbar: SeekBar = itemRoot.findViewById(R.id.audioSeekbar)
        val audioCurrent: TextView = itemRoot.findViewById(R.id.audioCurrentTime)
        val audioTotal: TextView = itemRoot.findViewById(R.id.audioTotalTime)

        // Per-item audio player (ExoPlayer instance) to avoid conflicts with video player
        private var audioPlayer: ExoPlayer? = null
        private val audioHandler = Handler()
        private val audioUpdateRunnable = object: Runnable {
            override fun run() {
                audioPlayer?.let { player ->
                    val pos = player.currentPosition
                    val dur = player.duration
                    if (dur > 0) {
                        audioSeekbar.progress = ((pos * 100) / dur).toInt()
                        audioCurrent.text = formatTime(pos)
                    }
                }
                audioHandler.postDelayed(this, 300)
            }
        }

        // Reset all media UI to hidden (called before bind)
        fun resetMediaUi() {
            mediaContainer.visibility = View.GONE
            postImage.visibility = View.GONE
            imagePageCallback?.let { imageCarousel.unregisterOnPageChangeCallback(it) }
            imagePageCallback = null
            imageCarousel.adapter = null
            imageCarousel.visibility = View.GONE
            imageCarouselCounter.visibility = View.GONE
            playerView?.visibility = View.GONE
            imageVideoThumbnail.visibility = View.GONE
            btnVideoPlay.visibility = View.GONE
            btnPlayPause?.visibility = View.GONE
            audioIcon.visibility = View.GONE
            textBackgroundPost.visibility = View.GONE
        }

        // Release audio player when view is recycled
        fun releaseAudio() {
            audioHandler.removeCallbacks(audioUpdateRunnable)
            audioPlayer?.let {
                try { it.pause() } catch (_: Exception) {}
                try { it.release() } catch (_: Exception) {}
            }
            audioPlayer = null
            audioSeekbar.progress = 0
            audioCurrent.text = "0:00"
            audioTotal.text = "0:00"
            btnAudioPlayPause.setImageResource(R.drawable.ic_play_circle)
        }

        fun bindImageCarousel(imageUrls: List<String>) {
            imagePageCallback?.let { imageCarousel.unregisterOnPageChangeCallback(it) }
            imageCarousel.adapter = FeedImageCarouselAdapter(imageUrls)
            imageCarousel.setCurrentItem(0, false)
            imageCarousel.visibility = View.VISIBLE

            if (imageUrls.size > 1) {
                imageCarouselCounter.visibility = View.VISIBLE
                imageCarouselCounter.text = "1/${imageUrls.size}"
                imagePageCallback = object : ViewPager2.OnPageChangeCallback() {
                    override fun onPageSelected(position: Int) {
                        imageCarouselCounter.text = "${position + 1}/${imageUrls.size}"
                    }
                }
                imageCarousel.registerOnPageChangeCallback(imagePageCallback!!)
            } else {
                imageCarouselCounter.visibility = View.GONE
            }
        }

        // Release video player reference from this ViewHolder.
        // IMPORTANT: we only detach the PlayerView if it's not the active view.
        fun safeDetachPlayerView() {
            try {
                if (playerView?.player === exoPlayer) {
                    // If this holder is not the active playing position, detach.
                    if (adapterPosition != currentPlayingPosition) {
                        playerView?.player = null
                    } // else: keep the player attached (user asked playback to continue)
                } else {
                    // Not attached to global player, safe to null
                    playerView?.player = null
                }
            } catch (_: Exception) {}
        }

        // Setup audio player for this ViewHolder
        fun setupAudio(url: String) {
            releaseAudio()
            try {
                audioPlayer = ExoPlayer.Builder(itemRoot.context).build().also { player ->
                    val item = MediaItem.fromUri(Uri.parse(url))
                    player.setMediaItem(item)
                    player.prepare()
                    player.addListener(object: Player.Listener {
                        override fun onPlaybackStateChanged(state: Int) {
                            if (state == Player.STATE_READY) {
                                val dur = player.duration
                                if (dur > 0) audioTotal.text = formatTime(dur)
                            }
                        }
                    })
                    btnAudioPlayPause.setOnClickListener {
                        if (player.isPlaying) {
                            player.pause()
                            btnAudioPlayPause.setImageResource(R.drawable.ic_play_circle)
                        } else {
                            player.play()
                            btnAudioPlayPause.setImageResource(R.drawable.ic_pause_circle)
                        }
                    }
                    audioSeekbar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                        override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                            if (fromUser && player.duration > 0) {
                                val seekTo = (player.duration * progress) / 100
                                player.seekTo(seekTo)
                            }
                        }
                        override fun onStartTrackingTouch(sb: SeekBar?) {}
                        override fun onStopTrackingTouch(sb: SeekBar?) {}
                    })
                    audioHandler.post(audioUpdateRunnable)
                }
            } catch (e: Exception) {
                Log.e("PostAdapter", "setupAudio error: ${e.message}")
            }
        }

        // Setup video thumbnail and play button; actual video playback handled by adapter when needed
        fun prepareVideoUi(videoUrl: String?, position: Int) {
            imageVideoThumbnail.visibility = View.VISIBLE
            btnVideoPlay.visibility = View.VISIBLE
            playerView?.visibility = View.GONE
            btnPlayPause?.visibility = View.GONE

            // load thumbnail (frame extraction)
            try {
                Glide.with(itemRoot.context)
                    .asBitmap()
                    .load(videoUrl)
                    .apply(RequestOptions().frame(4_000_000).diskCacheStrategy(DiskCacheStrategy.ALL))
                    .placeholder(R.drawable.video_placeholder)
                    .into(imageVideoThumbnail)
            } catch (_: Exception) {}

            btnVideoPlay.setOnClickListener {
                // prevent double clicks while preparing
                if (isPreparing) return@setOnClickListener
                throttleTap(btnVideoPlay, 700L)

                // Hide thumbnail UI, show player
                imageVideoThumbnail.visibility = View.GONE
                btnVideoPlay.visibility = View.GONE
                playerView?.visibility = View.VISIBLE
                btnPlayPause?.visibility = View.VISIBLE
                btnPlayPause?.setImageResource(R.drawable.ic_pause_circle)

                playVideoRequested(position)
            }

            btnPlayPause?.setOnClickListener {
                throttleTap(it, 250L)
                toggleRequested(position)
                btnPlayPause?.setImageResource(
                    if (exoPlayer?.isPlaying == true) {
                        R.drawable.ic_pause_circle
                    } else {
                        R.drawable.ic_play_circle
                    }
                )
            }
        }

        // Methods that call adapter functions (adapter controls single exoPlayer)
        private fun playVideoRequested(position: Int) {
            this@PostAdapter.playVideoAtPosition(position, this)
        }

        private fun toggleRequested(position: Int) {
            this@PostAdapter.toggleVideoAtPosition(position)
        }
    }

    // ----------------------
    // Adapter lifecycle
    // ----------------------

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        holder.resetMediaUi()
        val post = posts[position]

        // Header + engagement bind
        holder.username.text = post.userId.username
        holder.verifiedBadge.visibility = if (post.userId.verified) View.VISIBLE else View.GONE

        Glide.with(holder.itemRoot.context)
            .load(post.userId.profileImage)
            .placeholder(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(holder.profileImage)

        holder.profileImage.setOnClickListener { onUserClick(post.userId.id) }
        holder.username.setOnClickListener { onUserClick(post.userId.id) }

        holder.communityName.text = post.communityId?.displayName ?: "General"
        holder.timestamp.text = formatTimestamp(post.createdAt)
        holder.likeCount.text = "${post.likeCount} likes"
        holder.commentCount.text = "${post.commentCount} comments"
        holder.viewCount.text = "👁 ${post.viewCount}"

        holder.coinsEarned.visibility = if (post.coinsEarned > 0) {
            holder.coinsEarned.text = "🪙 ${post.coinsEarned} coins"
            View.VISIBLE
        } else View.GONE

        holder.updateLikeButton(post.likedByCurrentUser, holder.btnLike)
        holder.btnLike.setOnClickListener { view ->
            throttleTap(view)
            onLikeClick(post, position)
        }
        holder.likeCount.setOnClickListener { holder.btnLike.performClick() }
        holder.btnComment.setOnClickListener { view ->
            throttleTap(view)
            onCommentClick(post, position)
        }
        holder.commentCount.setOnClickListener { holder.btnComment.performClick() }
        holder.btnShare.setOnClickListener { view ->
            throttleTap(view)
            onShareClick(post)
        }
        holder.viewCount.setOnClickListener { holder.btnShare.performClick() }

        val currentUserId = TokenManager.getUserId(context)
        holder.fabFollow.setImageResource(R.drawable.ic_person_add)
        holder.fabFollow.backgroundTintList =
            ColorStateList.valueOf(ContextCompat.getColor(context, R.color.feed_action_background))
        holder.fabFollow.imageTintList =
            ColorStateList.valueOf(ContextCompat.getColor(context, R.color.feed_action_icon))
        holder.fabFollow.isEnabled = true
        holder.fabFollow.visibility = if (post.userId.id == currentUserId) View.GONE else View.VISIBLE
        holder.fabFollow.setOnClickListener {
            followPostAuthor(post, holder.fabFollow)
        }

        // Media
        val imageUrls = post.effectiveImageUrls()
        val hasImage = imageUrls.isNotEmpty()
        val hasVideo = !post.videoUrl.isNullOrEmpty()
        val hasAudio = !post.audioUrl.isNullOrEmpty()
        val hasMedia = hasImage || hasVideo || hasAudio
        val hasTextBackground = !hasMedia &&
            !post.caption.isNullOrBlank() &&
            TextPostBackgrounds.normalize(post.textBackgroundColor).isNotBlank()

        holder.postText.text = post.caption.orEmpty()
        holder.postText.visibility = if (post.caption.isNullOrBlank() || hasTextBackground) {
            View.GONE
        } else {
            View.VISIBLE
        }

        holder.mediaContainer.visibility = if (hasMedia || hasTextBackground) View.VISIBLE else View.GONE

        if (hasTextBackground) {
            holder.textBackgroundPost.text = post.caption.orEmpty()
            holder.textBackgroundPost.visibility = View.VISIBLE
            TextPostBackgrounds.apply(holder.textBackgroundPost, post.textBackgroundColor.orEmpty())
            recordVisibleView(post._id, 3)
        }

        if (hasImage) {
            holder.mediaContainer.visibility = View.VISIBLE
            holder.bindImageCarousel(imageUrls)
            recordVisibleView(post._id, 3)
        }

        if (hasVideo) {
            holder.mediaContainer.visibility = View.VISIBLE
            holder.prepareVideoUi(post.videoUrl, position)

            // If this position is currently playing, attach player view immediately
            if (position == currentPlayingPosition) {
                // ensure playerView is attached to the global player
                holder.playerView?.post {
                    attachPlayerToView(holder.playerView)
                    holder.playerView?.visibility = View.VISIBLE
                    holder.btnPlayPause?.visibility = View.VISIBLE
                    holder.btnPlayPause?.setImageResource(
                        if (exoPlayer?.isPlaying == true) {
                            R.drawable.ic_pause_circle
                        } else {
                            R.drawable.ic_play_circle
                        }
                    )
                }
            }
        }

        if (hasAudio) {
            holder.mediaContainer.visibility = View.VISIBLE
            holder.audioIcon.visibility = View.VISIBLE
            holder.setupAudio(post.audioUrl!!)
            recordVisibleView(post._id, 5)
        }

        holder.itemRoot.setOnClickListener {
            onPostClick(post)
            recordViewAsync(post._id)
        }

        val btnMoreOptions = holder.itemRoot.findViewById<ImageButton>(R.id.btnMoreOptions)
        btnMoreOptions.setOnClickListener {
            throttleTap(it)
            holder.showPostOptionsBottomSheet(post)
        }
    }

    override fun getItemCount(): Int = posts.size


    override fun onViewDetachedFromWindow(holder: PostViewHolder) {
        super.onViewDetachedFromWindow(holder)
        // Don't stop video playback here. Only detach player view if not active.
        holder.safeDetachPlayerView()
        holder.releaseAudio()
    }

    override fun onViewRecycled(holder: PostViewHolder) {
        super.onViewRecycled(holder)
        holder.releaseAudio()
        // If not active playing item, fully detach
        holder.safeDetachPlayerView()
    }


    private fun ensurePlayer() {
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build().also { player ->
                player.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(state: Int) {
                        try {
                            if (state == Player.STATE_ENDED) {
                                videoTimer?.cancel()
                                // optionally reset UI / thumbnail show if needed
                            }
                        } catch (_: Exception) {}
                    }
                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        // If playing changed, you could update UI for btnPlayPause via notifyItemChanged
                    }
                })
            }
        }
    }

    // Called by holder when user asked to play video for a holder
    private fun playVideoAtPosition(position: Int, holder: PostViewHolder) {
        val url = posts.getOrNull(position)?.videoUrl ?: return

        // prevent rapid double-taps
        if (isPreparing) return
        isPreparing = true

        ensurePlayer()

        if (currentPlayingPosition != -1 && currentPlayingPosition != position) {

            detachPlayer()
        }

        holder.playerView?.post {
            try {
                attachPlayerToView(holder.playerView)

                exoPlayer?.let { player ->
                    player.stop() // ensure no leftover
                    player.clearMediaItems()
                    player.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
                    player.prepare()
                    player.play()
                }

                currentPlayingPosition = position
                startVideoTimer(posts[position])
                recordVisibleView(posts[position]._id, 10)
            } catch (e: Exception) {
                Log.e("PostAdapter", "playVideoAtPosition error: ${e.message}")
            } finally {
                isPreparing = false
            }
        } ?: run {
            isPreparing = false
        }
    }

    private fun toggleVideoAtPosition(position: Int) {
        if (position != currentPlayingPosition) return
        val player = exoPlayer ?: return

        if (player.isPlaying) {
            player.pause()
            videoTimer?.cancel()
        } else {
            player.play()
            posts.getOrNull(position)?.let { startVideoTimer(it) }
        }
    }

    private fun throttleTap(view: View, delayMillis: Long = 350L) {
        view.isEnabled = false
        view.postDelayed({ view.isEnabled = true }, delayMillis)
    }

    private fun stopPlaybackInternal() {
        try {
            exoPlayer?.pause()
            exoPlayer?.stop()
            exoPlayer?.clearMediaItems()
        } catch (_: Exception) {}
        videoTimer?.cancel()
        currentPlayingPosition = -1
        detachPlayer()
    }

    private fun stopPlayback() {
        stopPlaybackInternal()
    }

    // Attach/detach helpers
    private fun attachPlayerToView(v: PlayerView?) {
        // detach current playerView reference (but don't stop player)
        try {
            if (currentPlayerView !== v) {
                currentPlayerView?.player = null
                v?.player = exoPlayer
                currentPlayerView = v
            }
        } catch (_: Exception) {}
    }

    private fun detachPlayer() {
        try {
            currentPlayerView?.player = null
            currentPlayerView = null
        } catch (_: Exception) {}
    }

    // Video reward timer (unchanged)
    private fun startVideoTimer(post: Post) {
        videoTimer?.cancel()
        videoSeconds = 0
        videoTimer = Timer()
        videoTimer?.scheduleAtFixedRate(1000, 1000) {
            videoSeconds++
            if (videoSeconds == 5 || videoSeconds == 10 || videoSeconds == 30) {
                sendVideoReward(post, videoSeconds)
            }
        }
    }

    private fun sendVideoReward(post: Post, seconds: Int) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val response = ApiClient.apiService.recordView(
                    post._id, "Bearer $token",
                    ViewRequest(seconds, "video")
                )
                if (response.isSuccessful) {
                    response.body()?.let { body ->
                        if (body.success) {
                            applyViewCount(post._id, maxOf(body.viewsCount, body.viewCount))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("PostAdapter", "Video reward error: ${e.message}")
            }
        }
    }

    fun updatePosts(newPosts: List<Post>) {
        posts = newPosts
        notifyDataSetChanged()
    }

    fun pauseAllVideos() {
        try {
            exoPlayer?.pause()
        } catch (_: Exception) {}
        videoTimer?.cancel()
    }

    fun releaseResources() {
        try {
            exoPlayer?.release()
            exoPlayer = null
        } catch (_: Exception) {}
        videoTimer?.cancel()
    }

    // View tracking used previously
    fun recordVisibleView(postId: String, seconds: Int) {
        val now = System.currentTimeMillis()
        if (now - (lastViewTime[postId] ?: 0) < 8000) return
        lastViewTime[postId] = now
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val post = posts.firstOrNull { it._id == postId }
                val response = ApiClient.apiService.recordView(
                    postId, "Bearer $token",
                    ViewRequest(seconds,
                        when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.effectiveImageUrls()?.isNotEmpty() == true -> "image"
                            else -> "text"
                        })
                )
                if (response.isSuccessful) {
                    response.body()?.let { body ->
                        if (body.success) {
                            applyViewCount(postId, maxOf(body.viewsCount, body.viewCount))
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e("PostAdapter", "Auto-view error: ${e.message}")
            }
        }
    }

    private fun recordViewAsync(postId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val post = posts.firstOrNull { it._id == postId }
                val response = ApiClient.apiService.recordView(
                    postId, "Bearer $token",
                    ViewRequest(5,
                        when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.effectiveImageUrls()?.isNotEmpty() == true -> "image"
                            else -> "text"
                        })
                )
                if (response.isSuccessful) {
                    response.body()?.let { body ->
                        if (body.success) {
                            applyViewCount(postId, maxOf(body.viewsCount, body.viewCount))
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun applyViewCount(postId: String, viewsCount: Int) {
        val index = posts.indexOfFirst { it._id == postId }
        if (index >= 0) {
            posts[index].viewCount = viewsCount
        }

        CoroutineScope(Dispatchers.Main).launch {
            onViewCountUpdated(postId, viewsCount)
            if (index >= 0) notifyItemChanged(index)
        }
    }

    private fun followPostAuthor(post: Post, followButton: FloatingActionButton) {
        val token = TokenManager.getToken(context)
        val targetUserId = post.userId.id

        if (token.isNullOrBlank()) {
            Toast.makeText(context, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        if (targetUserId.isBlank() || targetUserId == TokenManager.getUserId(context)) {
            return
        }

        followButton.isEnabled = false
        ApiClient.apiService.followUser(targetUserId, "Bearer $token")
            .enqueue(object : Callback<FollowResponse> {
                override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                    followButton.isEnabled = true
                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        followButton.setImageResource(R.drawable.ic_check)
                        followButton.backgroundTintList =
                            ColorStateList.valueOf(ContextCompat.getColor(context, R.color.feed_action_background))
                        followButton.imageTintList =
                            ColorStateList.valueOf(ContextCompat.getColor(context, R.color.feed_action_icon))
                        followButton.isEnabled = false
                        Toast.makeText(context, body.message, Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "Could not follow ${post.userId.username}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                    followButton.isEnabled = true
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // Helpers for ViewHolder (small extension function)
    private fun PostViewHolder.updateLikeButton(isLiked: Boolean, btn: ImageButton) {
        btn.setImageResource(if (isLiked) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline)
    }

    private fun formatTime(ms: Long): String {
        val totalSec = ms / 1000
        return String.format("%d:%02d", totalSec / 60, totalSec % 60)
    }

    private fun formatTimestamp(rawTimestamp: String?): String {
        val timestamp = parseTimestampMillis(rawTimestamp) ?: return ""
        val diffMillis = System.currentTimeMillis() - timestamp
        val diffSeconds = diffMillis / 1000

        return when {
            diffSeconds < 60 -> "now"
            diffSeconds < 3600 -> "${diffSeconds / 60}m"
            diffSeconds < 86400 -> "${diffSeconds / 3600}h"
            diffSeconds < 604800 -> "${diffSeconds / 86400}d"
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

    private fun PostViewHolder.showPostOptionsBottomSheet(post: Post) {
        val bottomSheet = BottomSheetDialog(context)
        val view = LayoutInflater.from(context).inflate(R.layout.bottomsheet_post_options, null)

        val optionDelete = view.findViewById<TextView>(R.id.optionDelete)
        val optionHide = view.findViewById<TextView>(R.id.optionHide)
        val optionDownload = view.findViewById<TextView>(R.id.optionDownload)
        val optionFlag = view.findViewById<TextView>(R.id.optionFlag)

        val currentUserId = TokenManager.getUserId(context)
        optionDelete.visibility = if (post.userId.id == currentUserId) View.VISIBLE else View.GONE

        optionDelete.setOnClickListener {
            bottomSheet.dismiss()
            onDeleteClickListener?.invoke(post)
        }
        optionHide.setOnClickListener {
            bottomSheet.dismiss()
            onHideClickListener?.invoke(post)
        }
        optionDownload.setOnClickListener {
            bottomSheet.dismiss()
            onDownloadClickListener?.invoke(post)
        }
        optionFlag.setOnClickListener {
            bottomSheet.dismiss()
            onFlagClickListener?.invoke(post)
        }
        bottomSheet.setContentView(view)
        bottomSheet.show()
    }
}
