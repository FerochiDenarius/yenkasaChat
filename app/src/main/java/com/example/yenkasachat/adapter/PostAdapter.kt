package com.example.yenkasachat.adapter

import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.ViewRequest
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class PostAdapter(
    private val context: Context,
    private var posts: List<Post>,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post, Int) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit,
    private val onShareClick: (Post) -> Unit
) : RecyclerView.Adapter<PostAdapter.PostViewHolder>() {      // ✅ FIXED SIGNATURE

    private var exoPlayer: ExoPlayer? = null
    private var currentPlayingPosition: Int = -1
    private var currentPlayerView: PlayerView? = null
    private var mediaPlayer: MediaPlayer? = null
    private val activePlayers = mutableListOf<ExoPlayer>()

    private val lastViewTime = mutableMapOf<String, Long>()


    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {

        private val profileImage: ImageView = itemView.findViewById(R.id.imageProfilePost)
        private val username: TextView = itemView.findViewById(R.id.textUsernamePost)
        private val verifiedBadge: ImageView = itemView.findViewById(R.id.imageVerifiedBadge)
        private val timestamp: TextView = itemView.findViewById(R.id.textTimestampPost)
        private val communityName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val postText: TextView = itemView.findViewById(R.id.textPostContent)
        private val postImage: ImageView = itemView.findViewById(R.id.imagePostContent)
        private val audioIcon: LinearLayout = itemView.findViewById(R.id.audioIcon)
        private val btnLike: ImageButton = itemView.findViewById(R.id.btnLike)
        private val btnComment: ImageButton = itemView.findViewById(R.id.btnComment)
        private val btnShare: ImageButton = itemView.findViewById(R.id.btnShare)
        private val likeCount: TextView = itemView.findViewById(R.id.textLikeCount)
        private val commentCount: TextView = itemView.findViewById(R.id.textCommentCount)
        private val coinsEarned: TextView = itemView.findViewById(R.id.textCoinsEarned)

        private val playerView: PlayerView? = itemView.findViewById(R.id.playerView)
        private val btnPlayPause: ImageButton? = itemView.findViewById(R.id.btnPlayPause)

        fun bind(post: Post, position: Int) {

            username.text = post.userId.username
            verifiedBadge.visibility = if (post.userId.verified) View.VISIBLE else View.GONE

            Glide.with(itemView.context)
                .load(post.userId.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(profileImage)

            profileImage.setOnClickListener { onUserClick(post.userId.id) }
            username.setOnClickListener { onUserClick(post.userId.id) }

            communityName.text = post.communityId?.displayName ?: "General"
            timestamp.text = formatTimestamp(post.createdAt.toLongOrNull())
            postText.text = post.caption ?: ""

            likeCount.text = "${post.likeCount} likes"
            commentCount.text = "${post.commentCount} comments"

            coinsEarned.visibility =
                if (post.coinsEarned > 0) {
                    coinsEarned.text = "🪙 ${post.coinsEarned} coins"
                    View.VISIBLE
                } else View.GONE

            updateLikeButton(post.likedByCurrentUser, btnLike)
            btnLike.setOnClickListener { onLikeClick(post, position) }

            btnComment.setOnClickListener { onCommentClick(post, position) }
            btnShare.setOnClickListener { onShareClick(post) }

            handleMedia(post, position)

            itemView.setOnClickListener {
                onPostClick(post)
                recordViewAsync(post._id)   // manual view
            }
        }

        fun updateLikeButton(isLiked: Boolean, btn: ImageButton) {
            btn.setImageResource(
                if (isLiked) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline
            )
        }

        private fun handleMedia(post: Post, position: Int) {
            val hasImage = !post.imageUrl.isNullOrEmpty()
            val hasVideo = !post.videoUrl.isNullOrEmpty()
            val hasAudio = !post.audioUrl.isNullOrEmpty()

            postImage.visibility = if (hasImage) View.VISIBLE else View.GONE
            playerView?.visibility = if (hasVideo) View.VISIBLE else View.GONE
            btnPlayPause?.visibility = if (hasVideo) View.VISIBLE else View.GONE
            audioIcon.visibility = if (hasAudio) View.VISIBLE else View.GONE

            if (hasImage) {
                Glide.with(itemView.context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(postImage)

                recordVisibleView(post._id, 3)    // ⭐ reward for images
            }

            if (hasVideo) {
                if (position == currentPlayingPosition) attachPlayerToView(playerView)
                else playerView?.player = null

                btnPlayPause?.setOnClickListener { toggleVideo(position) }
                playerView?.setOnClickListener { toggleVideo(position) }
            }

            if (hasAudio) {
                audioIcon.setOnClickListener { playAudio(post.audioUrl!!) }
                recordVisibleView(post._id, 5)     // ⭐ reward for audio
            }
        }

        private fun toggleVideo(position: Int) {
            val player = exoPlayer
            if (player == null) {
                playVideoAtPosition(position)
                return
            }

            if (position != currentPlayingPosition) {
                playVideoAtPosition(position)
                return
            }

            if (player.isPlaying) player.pause() else player.play()
            btnPlayPause?.setImageResource(
                if (player.isPlaying) R.drawable.ic_pause_circle
                else R.drawable.ic_play_circle
            )
        }

        private fun playAudio(url: String) {
            try {
                mediaPlayer?.release()
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(url)
                    prepare()
                    start()
                }
            } catch (e: Exception) {
                Log.e("PostAdapter", "Audio error: ${e.message}")
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view =
            LayoutInflater.from(parent.context).inflate(R.layout.item_post, parent, false)
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


    fun playVideoAtPosition(position: Int) {
        detachPlayer()

        val url = posts[position].videoUrl ?: return

        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build()
            activePlayers.add(exoPlayer!!)
        }

        exoPlayer!!.apply {
            setMediaItem(MediaItem.fromUri(Uri.parse(url)))
            prepare()
            play()
        }

        currentPlayingPosition = position
        notifyItemChanged(position)

        recordVisibleView(posts[position]._id, 10)    // ⭐ reward for video
    }


    private fun attachPlayerToView(v: PlayerView?) {
        if (v == null) return
        currentPlayerView?.player = null
        v.player = exoPlayer
        currentPlayerView = v
    }

    private fun detachPlayer() {
        currentPlayerView?.player = null
        currentPlayerView = null
    }

    fun pauseAllVideos() {
        activePlayers.forEach { it.pause() }
    }


    // ⭐⭐⭐ PUBLIC — NOW FEED FRAGMENT CAN CALL IT ⭐⭐⭐
    fun recordVisibleView(postId: String, seconds: Int) {
        val now = System.currentTimeMillis()
        val last = lastViewTime[postId] ?: 0

        if (now - last < 8_000) return
        lastViewTime[postId] = now

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val post = getPostById(postId)

                ApiClient.apiService.recordView(
                    postId,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = seconds,
                        viewType = when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.imageUrl?.isNotEmpty() == true -> "image"
                            else -> "text"
                        }
                    )
                )
            } catch (e: Exception) {
                Log.e("PostAdapter", "Auto-view error: ${e.message}")
            }
        }
    }

    private fun recordViewAsync(postId: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val post = getPostById(postId)

                ApiClient.apiService.recordView(
                    postId,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = 5,
                        viewType = when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.imageUrl?.isNotEmpty() == true -> "image"
                            else -> "text"
                        }
                    )
                )
            } catch (e: Exception) { }
        }
    }

    private fun formatTimestamp(ts: Long?): String {
        if (ts == null) return ""
        val sdf = SimpleDateFormat("dd MMM • hh:mm a", Locale.getDefault())
        return sdf.format(Date(ts))
    }
    private fun getPostById(postId: String): Post? {
        return posts.firstOrNull { it._id == postId }
    }

    fun releaseResources() {
        exoPlayer?.release()
        mediaPlayer?.release()
    }
}
