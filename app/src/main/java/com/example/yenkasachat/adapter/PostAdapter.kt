package com.example.yenkasachat.adapter

import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
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
) : RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    private var exoPlayer: ExoPlayer? = null
    private var currentPlayingPosition: Int = -1
    private var currentPlayerView: PlayerView? = null
    private var mediaPlayer: MediaPlayer? = null
    private val activePlayers = mutableListOf<ExoPlayer>()



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

            handleMedia(post, position)

            itemView.setOnClickListener {
                onPostClick(post)
                recordViewAsync(itemView.context, post._id)
            }
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
                    .error(R.drawable.placeholder_image)
                    .into(postImage)
            }

            if (hasVideo) {
                val videoUrl = post.videoUrl ?: return
                if (position == currentPlayingPosition) {
                    attachPlayerToView(playerView)
                } else {
                    playerView?.player = null
                }

                btnPlayPause?.setOnClickListener {
                    toggleVideoPlayPause(position)
                }
                playerView?.setOnClickListener {
                    toggleVideoPlayPause(position)
                }

            }

            if (hasAudio) {
                audioIcon.setOnClickListener {
                    playAudio(post.audioUrl!!)
                }
            }
        }

        private fun toggleVideoPlayPause(position: Int) {
            val player = exoPlayer
            if (player == null) {
                playVideoAtPosition(position)
                return
            }

            if (position != currentPlayingPosition) {
                playVideoAtPosition(position)
                return
            }

            if (player.isPlaying) {
                player.pause()
            } else {
                player.play()
            }

            updatePlayPauseIcon()
        }

        private fun playAudio(url: String) {
            try {
                mediaPlayer?.release()
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(url)
                    prepare()
                    start()
                }
                Toast.makeText(itemView.context, "🎧 Playing audio", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e("PostAdapter", "❌ Error playing audio: ${e.message}")
            }
        }

        private fun updatePlayPauseIcon() {
            val playing = exoPlayer?.isPlaying == true
            btnPlayPause?.setImageResource(
                if (playing) R.drawable.ic_pause_circle else R.drawable.ic_play_circle
            )
        }

        fun updateLikeButton(isLiked: Boolean, btnLike: ImageButton) {
            btnLike.setImageResource(
                if (isLiked) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline
            )
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        holder.bind(posts[position], position)
    }

    override fun getItemCount() = posts.size

    fun updatePosts(newPosts: List<Post>) {
        posts = newPosts
        notifyDataSetChanged()
    }

    fun playVideoAtPosition(position: Int) {
        detachPlayerFromCurrentView()

        val post = posts.getOrNull(position)
        val videoUrl = post?.videoUrl ?: return

        if (exoPlayer == null) {
            exoPlayer = ExoPlayer.Builder(context).build().apply {   // ✅ use context directly
                volume = 0f
                activePlayers.add(this)
            }
        }

        val mediaItem = MediaItem.fromUri(Uri.parse(videoUrl))
        exoPlayer?.apply {
            setMediaItem(mediaItem)
            prepare()
            playWhenReady = true
            play()
        }

        currentPlayingPosition = position
        notifyItemChanged(position)
    }

    private fun attachPlayerToView(playerView: PlayerView?) {
        if (playerView == null) return
        exoPlayer?.let { player ->
            if (currentPlayerView != null && currentPlayerView !== playerView) {
                currentPlayerView?.player = null
            }
            playerView.player = player
            currentPlayerView = playerView
        }
    }

    private fun detachPlayerFromCurrentView() {
        currentPlayerView?.player = null
        currentPlayerView = null
    }
    fun pauseAllVideos() {
        try {
            activePlayers.forEach { player -> player.pause() }
        } catch (e: Exception) {
            Log.e("PostAdapter", "Error pausing videos: ${e.message}")
        }
    }

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
        return text
    }

    fun formatTimestamp(timestamp: Long?): String {
        if (timestamp == null) return ""
        val date = Date(timestamp)
        val sdf = SimpleDateFormat("dd MMM • hh:mm a", Locale.getDefault())
        return sdf.format(date)
    }


    fun releaseResources() {
        exoPlayer?.release()
        mediaPlayer?.release()
        exoPlayer = null
        mediaPlayer = null
        currentPlayingPosition = -1
        currentPlayerView = null
    }
}
