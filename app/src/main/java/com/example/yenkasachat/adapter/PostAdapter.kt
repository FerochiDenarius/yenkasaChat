package com.example.yenkasachat.adapter

import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.content.Context
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class PostAdapter(
    private var posts: List<Post>,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post, Int) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit,
    private val onShareClick: (Post) -> Unit
) : RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    // Single shared ExoPlayer instance for visible video
    private var exoPlayer: ExoPlayer? = null
    private var currentPlayingPosition: Int = -1
    private var currentPlayerView: PlayerView? = null

    init {
        // Player will be created lazily when first needed
    }

    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {

        private val profileImage: ImageView = itemView.findViewById(R.id.imageProfilePost)
        private val username: TextView = itemView.findViewById(R.id.textUsernamePost)
        private val verifiedBadge: ImageView = itemView.findViewById(R.id.imageVerifiedBadge)
        private val timestamp: TextView = itemView.findViewById(R.id.textTimestampPost)
        private val communityName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val postText: TextView = itemView.findViewById(R.id.textPostContent)
        private val postImage: ImageView = itemView.findViewById(R.id.imagePostContent)
        private val mediaRecycler: RecyclerView? = itemView.findViewById(R.id.recyclerMediaList)
        private val btnLike: ImageButton = itemView.findViewById(R.id.btnLike)
        private val btnComment: ImageButton = itemView.findViewById(R.id.btnComment)
        private val btnShare: ImageButton = itemView.findViewById(R.id.btnShare)
        private val likeCount: TextView = itemView.findViewById(R.id.textLikeCount)
        private val commentCount: TextView = itemView.findViewById(R.id.textCommentCount)
        private val coinsEarned: TextView = itemView.findViewById(R.id.textCoinsEarned)

        // New video-related views
        private val playerView: PlayerView? = itemView.findViewById(R.id.playerView)
        private val btnPlayPause: ImageButton? = itemView.findViewById(R.id.btnPlayPause)

        fun bind(post: Post, position: Int) {
            val user = post.userId
            username.text = user.username
            verifiedBadge.visibility = if (user.verified) View.VISIBLE else View.GONE

            Glide.with(itemView.context)
                .load(user.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .error(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(profileImage)

            val userId = user.id
            profileImage.setOnClickListener { onUserClick(userId) }
            username.setOnClickListener { onUserClick(userId) }

            communityName.text = post.communityId?.displayName ?: "General"
            timestamp.text = formatTimestamp(post.createdAt?.toLongOrNull())
            postText.text = highlightMentions(post.caption ?: "", post.mentions)

            likeCount.text = "${post.likeCount} likes"
            commentCount.text = "${post.commentCount} comments"

            coinsEarned.visibility = if (post.coinsEarned > 0) {
                coinsEarned.text = "🪙 ${post.coinsEarned} coins earned"
                View.VISIBLE
            } else View.GONE

            updateLikeButton(post.likedByCurrentUser, btnLike)

            btnLike.setOnClickListener { onLikeClick(post, position) }
            btnComment.setOnClickListener { onCommentClick(post, position) }
            btnShare.setOnClickListener { onShareClick(post) }

            // Handle media (images, gallery, or single video)
            handleMedia(post, position)

            // When this ViewHolder is bound, if it is the currently playing position,
            // attach the playerView to our shared exoPlayer.
            if (position == currentPlayingPosition && playerView != null) {
                attachPlayerToView(playerView)
                btnPlayPause?.visibility = View.VISIBLE
                updatePlayPauseIcon()
            } else {
                // Ensure playerView doesn't hold the player if it's not the active one
                if (playerView != null) {
                    if (playerView.player != null) {
                        // detach
                        playerView.player = null
                    }
                    playerView.visibility = View.GONE
                }
                btnPlayPause?.visibility = View.GONE
            }

            // Play/pause toggle behavior on overlay button or playerView tap
            btnPlayPause?.setOnClickListener {
                togglePlayPause(position)
            }

            playerView?.setOnClickListener {
                togglePlayPause(position)
            }

            // click to open post (images open fullscreen in your app logic)
            itemView.setOnClickListener {
                onPostClick(post)
                recordViewAsync(itemView.context, post._id)
            }
        }

        private fun handleMedia(post: Post, position: Int) {
            val mediaList = post.mediaUrls ?: emptyList()

            // If there's a video in mediaList, show PlayerView and hide image/gallery
            val videoUrl = mediaList.firstOrNull { isVideoUrl(it) }
            if (videoUrl != null) {
                // Show player view
                postImage.visibility = View.GONE
                mediaRecycler?.visibility = View.GONE

                playerView?.visibility = View.VISIBLE
                btnPlayPause?.visibility = View.VISIBLE

                // If this item is currently the playing position, attach and ensure prepared
                if (position == currentPlayingPosition) {
                    attachPlayerToView(playerView)
                } else {
                    // show thumbnail (glide) until played: use first frame or a placeholder
                    // For simplicity, set playerView background temporarily
                    // (If you have a thumbnail URL, load it into playerView.overlay or an image)
                }

            } else if (mediaList.isNotEmpty()) {
                // Show gallery horizontal recycler for multiple media (images)
                postImage.visibility = View.GONE
                playerView?.visibility = View.GONE
                btnPlayPause?.visibility = View.GONE

                mediaRecycler?.apply {
                    visibility = View.VISIBLE
                    layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
                    adapter = PostMediaAdapter(mediaList)
                }
            } else if (!post.imageUrl.isNullOrEmpty()) {
                // Single image
                mediaRecycler?.visibility = View.GONE
                playerView?.visibility = View.GONE
                btnPlayPause?.visibility = View.GONE

                postImage.visibility = View.VISIBLE
                Glide.with(itemView.context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.placeholder_image)
                    .into(postImage)
            } else {
                // No media
                postImage.visibility = View.GONE
                mediaRecycler?.visibility = View.GONE
                playerView?.visibility = View.GONE
                btnPlayPause?.visibility = View.GONE
            }
        }

        private fun togglePlayPause(position: Int) {
            val player = exoPlayer
            if (player == null) {
                // If player isn't created, start playback for this position
                playVideoAtPosition(position)
                return
            }

            if (position != currentPlayingPosition) {
                // start a new video
                playVideoAtPosition(position)
                return
            }

            // same position -> toggle
            if (player.isPlaying) {
                player.pause()
            } else {
                player.play()
            }
            updatePlayPauseIcon()
        }

        fun updateLikeButton(isLiked: Boolean, btnLike: ImageButton) {
            btnLike.setImageResource(
                if (isLiked) R.drawable.ic_heart_filled
                else R.drawable.ic_heart_outline
            )
        }

        private fun updatePlayPauseIcon() {
            val playing = exoPlayer?.isPlaying == true
            btnPlayPause?.setImageResource(
                if (playing) R.drawable.ic_pause_circle else R.drawable.ic_play_circle
            )
            // optionally hide when playing:
            // btnPlayPause?.visibility = if (playing) View.GONE else View.VISIBLE
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        holder.bind(posts[position], position)
    }

    override fun getItemCount(): Int = posts.size

    fun updatePosts(newPosts: List<Post>) {
        posts = newPosts
        notifyDataSetChanged()
    }

    fun updateLikeStatus(position: Int, isLiked: Boolean, likeCount: Int) {
        if (position in posts.indices) {
            val updatedPost = posts[position].copy(
                likedByCurrentUser = isLiked,
                likeCount = likeCount
            )
            (posts as? MutableList<Post>)?.set(position, updatedPost)
            notifyItemChanged(position)
        }
    }

    // Public API used by FeedFragment
    fun playVideoAtPosition(position: Int) {
        if (position !in posts.indices) return

        val post = posts[position]
        val mediaList = post.mediaUrls ?: emptyList()
        val videoUrl = mediaList.firstOrNull { isVideoUrl(it) } ?: return

        // If same position, ensure it plays
        if (position == currentPlayingPosition) {
            exoPlayer?.let {
                it.playWhenReady = true
                it.play()
            }
            return
        }

        // new position: stop previous
        detachPlayerFromCurrentView()

        // make sure player exists
        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(itemViewContext()).build().apply {
                // start muted by default
                volume = 0f
            }
        }

        // prepare media
        val mediaItem = MediaItem.fromUri(Uri.parse(videoUrl))
        exoPlayer?.apply {
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
            play()
            // keep volume 0 (muted). You could add a toggle in UI later for sound.
            volume = 0f
        }

        currentPlayingPosition = position

        // Tell currently bound view holder (if exists) to attach player immediately
        // This uses a best-effort approach: findViewHolderForAdapterPosition on owning RecyclerView.
        // The FeedFragment's recycler is the owner; adapter doesn't hold a direct reference.
        // Instead we'll attempt to attach when that ViewHolder binds (in bind()).
        notifyItemChanged(position)
    }

    fun pauseAllVideos() {
        try {
            exoPlayer?.let {
                it.pause()
            }
        } catch (e: Exception) {
            Log.e("PostAdapter", "Error pausing videos: ${e.message}", e)
        }
    }

    // Call this when leaving the fragment to release resources
    fun releasePlayer() {
        try {
            exoPlayer?.release()
        } catch (e: Exception) {
            Log.e("PostAdapter", "Error releasing player: ${e.message}", e)
        } finally {
            exoPlayer = null
            currentPlayingPosition = -1
            currentPlayerView = null
        }
    }

    // Helper: attach player to PlayerView
    private fun attachPlayerToView(playerView: PlayerView?) {
        if (playerView == null) return
        exoPlayer?.let { player ->
            // detach from old view if different
            if (currentPlayerView != null && currentPlayerView !== playerView) {
                currentPlayerView?.player = null
            }
            playerView.player = player
            currentPlayerView = playerView

            // update overlay icon: find overlay and set correct icon
            val overlay = playerView.rootView.findViewById<ImageButton?>(R.id.btnPlayPause)
            overlay?.visibility = View.VISIBLE
            overlay?.setImageResource(if (player.isPlaying) R.drawable.ic_pause_circle else R.drawable.ic_play_circle)
        }
    }


    private fun detachPlayerFromCurrentView() {
        currentPlayerView?.player = null
        currentPlayerView = null
        // don't release the player here, we keep it for the next video
    }

    // Utility to check if a url looks like a video
    private fun isVideoUrl(url: String?): Boolean {
        if (url.isNullOrEmpty()) return false
        val lower = url.toLowerCase(Locale.ROOT)
        return lower.endsWith(".mp4") ||
                lower.endsWith(".m3u8") ||
                lower.endsWith(".mov") ||
                lower.endsWith(".webm") ||
                lower.contains("video")
    }

    // helper to record view asynchronously
    private fun recordViewAsync(context: Context, postId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context)
                if (!token.isNullOrEmpty()) {
                    val response = ApiClient.apiService.recordView(postId, "Bearer $token")
                    if (!response.isSuccessful) {
                        Log.w("PostAdapter", "Failed to record view for $postId")
                    }
                }
            } catch (e: Exception) {
                Log.e("PostAdapter", "Error recording view: ${e.message}", e)
            }
        }
    }

    fun highlightMentions(text: String, mentions: List<String>?): CharSequence {
        // TODO: apply SpannableString highlights if you want
        return text
    }

    fun formatTimestamp(timestamp: Long?): String {
        if (timestamp == null) return ""
        val date = Date(timestamp)
        val sdf = SimpleDateFormat("dd MMM • hh:mm a", Locale.getDefault())
        return sdf.format(date)
    }

    private fun itemViewContext(): android.content.Context {
        return try {
            val ctx = (android.app.Application().applicationContext)
            ctx
        } catch (e: Exception) {
            throw IllegalStateException("Cannot obtain context to initialize ExoPlayer. Ensure adapter used in Activity/Fragment.")
        }
    }
}
