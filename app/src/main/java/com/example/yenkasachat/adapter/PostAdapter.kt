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
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import java.text.SimpleDateFormat
import java.util.*
import com.google.android.material.bottomsheet.BottomSheetDialog

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

    // ---------------------------------------------
//  EXTRA CALLBACKS for (Delete / Hide / Download / Flag)
// ---------------------------------------------
    private var onDeleteClickListener: ((Post) -> Unit)? = null
    private var onHideClickListener: ((Post) -> Unit)? = null
    private var onDownloadClickListener: ((Post) -> Unit)? = null
    private var onFlagClickListener: ((Post) -> Unit)? = null

    fun setOnDeleteClickListener(listener: (Post) -> Unit) { onDeleteClickListener = listener }
    fun setOnHideClickListener(listener: (Post) -> Unit) { onHideClickListener = listener }
    fun setOnDownloadClickListener(listener: (Post) -> Unit) { onDownloadClickListener = listener }
    fun setOnFlagClickListener(listener: (Post) -> Unit) { onFlagClickListener = listener }




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
        private val viewCount: TextView = itemView.findViewById(R.id.textViewCount)
        private val btnAudioPlayPause: ImageButton = itemView.findViewById(R.id.btnAudioPlayPause)
        private val audioSeekbar: SeekBar = itemView.findViewById(R.id.audioSeekbar)
        private val audioCurrent: TextView = itemView.findViewById(R.id.audioCurrentTime)
        private val audioTotal: TextView = itemView.findViewById(R.id.audioTotalTime)
        private val imageVideoThumbnail: ImageView = itemView.findViewById(R.id.imageVideoThumbnail)
        private val btnVideoPlay: ImageButton = itemView.findViewById(R.id.btnVideoPlay)


        private var audioPlayer: ExoPlayer? = null

        private val audioHandler = android.os.Handler()
        private val audioUpdateRunnable = object : Runnable {
            override fun run() {
                audioPlayer?.let { player ->
                    if (player.isPlaying) {
                        val pos = player.currentPosition
                        val dur = player.duration

                        if (dur > 0) {
                            audioSeekbar.progress = ((pos * 100) / dur).toInt()
                        }

                        audioCurrent.text = formatTime(pos)
                    }
                }
                audioHandler.postDelayed(this, 300)
            }
        }

         fun showPostOptionsBottomSheet(post: Post) {
            val bottomSheet = BottomSheetDialog(context)
            val view = LayoutInflater.from(context).inflate(R.layout.bottomsheet_post_options, null)

            val optionDelete = view.findViewById<TextView>(R.id.optionDelete)
            val optionHide = view.findViewById<TextView>(R.id.optionHide)
            val optionDownload = view.findViewById<TextView>(R.id.optionDownload)
            val optionFlag = view.findViewById<TextView>(R.id.optionFlag)

            // Show delete only if the post belongs to current user
            val currentUserId = TokenManager.getUserId(context)
            if (post.userId.id == currentUserId) {
                optionDelete.visibility = View.VISIBLE
            }

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



        private fun setupAudioPlayer(url: String) {
            try {
                audioPlayer?.release()

                audioHandler.removeCallbacks(audioUpdateRunnable)
                audioPlayer?.stop()
                audioPlayer?.release()
                audioPlayer = null


                audioPlayer = ExoPlayer.Builder(context).build().also { player ->

                    val item = MediaItem.fromUri(Uri.parse(url))
                    player.setMediaItem(item)
                    player.prepare()

                    // Listener with correct import + correct signature
                    player.addListener(object : androidx.media3.common.Player.Listener {
                        override fun onPlaybackStateChanged(playbackState: Int) {
                            if (playbackState == androidx.media3.common.Player.STATE_READY) {
                                val dur = player.duration
                                audioTotal.text = formatTime(dur)
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
                            if (fromUser) {
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
                Log.e("PostAdapter", "Audio setup error: ${e.message}")
            }
        }

        fun releaseAudio() {
            try {
                audioHandler.removeCallbacks(audioUpdateRunnable)

                audioPlayer?.let { player ->
                    try { player.stop() } catch (_: Exception) {}
                    try { player.release() } catch (_: Exception) {}
                }

                audioPlayer = null

                audioSeekbar.progress = 0
                audioCurrent.text = "0:00"
                audioTotal.text = "0:00"
                btnAudioPlayPause.setImageResource(R.drawable.ic_play_circle)
            } catch (e: Exception) {
                Log.e("PostAdapter", "releaseAudio error: ${e.message}")
            }
        }


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
            viewCount.text = "👁 ${post.viewCount}"

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
            playerView?.visibility = View.GONE
            btnPlayPause?.visibility = View.GONE
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

            // --- VIDEO THUMBNAIL ---
// --- VIDEO THUMBNAIL ---
            if (!post.videoUrl.isNullOrEmpty()) {

                imageVideoThumbnail.visibility = View.VISIBLE
                btnVideoPlay.visibility = View.VISIBLE

                Glide.with(itemView.context)
                    .asBitmap()
                    .load(post.videoUrl)
                    .apply(
                        RequestOptions()
                            .frame(4_000_000)  // 1 second
                            .diskCacheStrategy(DiskCacheStrategy.ALL)
                    )
                    .placeholder(R.drawable.video_placeholder)
                    .error(R.drawable.video_placeholder)
                    .into(imageVideoThumbnail)
            } else {
                imageVideoThumbnail.visibility = View.GONE
                btnVideoPlay.visibility = View.GONE
            }

            btnVideoPlay.setOnClickListener {
                imageVideoThumbnail.visibility = View.GONE
                btnVideoPlay.visibility = View.GONE

                // SHOW PLAYER VIEW (this was missing)
                playerView?.visibility = View.VISIBLE
                btnPlayPause?.visibility = View.VISIBLE

                if (exoPlayer == null) {
                    exoPlayer = ExoPlayer.Builder(context).build()
                    activePlayers.add(exoPlayer!!)
                }

                playerView?.player = exoPlayer

                exoPlayer!!.apply {
                    setMediaItem(MediaItem.fromUri(post.videoUrl!!))
                    prepare()
                    play()
                }

                // update tracking
                currentPlayingPosition = position
            }


            if (hasAudio) {
                audioIcon.visibility = View.VISIBLE      // your whole audio UI lives here
                setupAudioPlayer(post.audioUrl!!)
                recordVisibleView(post._id, 5)
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

    }
    private fun formatTime(ms: Long): String {
        val totalSec = ms / 1000
        val min = totalSec / 60
        val sec = totalSec % 60
        return String.format("%d:%02d", min, sec)
    }



    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view =
            LayoutInflater.from(parent.context).inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]
        holder.bind(post, position)

        // SHOW OPTIONS WHEN USER TAPS THE 3 DOT BUTTON
        val btnMoreOptions = holder.itemView.findViewById<ImageButton>(R.id.btnMoreOptions)
        btnMoreOptions.setOnClickListener {
            holder.showPostOptionsBottomSheet(post)
        }
    }


    override fun onViewRecycled(holder: PostViewHolder) {
        super.onViewRecycled(holder)
        holder.releaseAudio()
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

                val response = ApiClient.apiService.recordView(
                    postId,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = seconds,
                        mediaType = when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.imageUrl?.isNotEmpty() == true -> "image"
                            else -> "text"
                        }
                    )
                )

                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.success) {
                        post?.viewCount = body.viewsCount
                        CoroutineScope(Dispatchers.Main).launch {
                            notifyItemChanged(posts.indexOfFirst { it._id == postId })
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
                val post = getPostById(postId)

                val response = ApiClient.apiService.recordView(
                    postId,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = 5,
                        mediaType = when {
                            post?.videoUrl?.isNotEmpty() == true -> "video"
                            post?.audioUrl?.isNotEmpty() == true -> "audio"
                            post?.imageUrl?.isNotEmpty() == true -> "image"
                            else -> "text"
                        }
                    )
                )

                if (response.isSuccessful) {
                    val body = response.body()
                    if (body != null && body.success) {
                        post?.viewCount = body.viewsCount
                        CoroutineScope(Dispatchers.Main).launch {
                            notifyItemChanged(posts.indexOfFirst { it._id == postId })
                        }
                    }
                }
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
