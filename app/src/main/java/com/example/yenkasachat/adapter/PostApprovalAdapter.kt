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

class PostApprovalAdapter(
    private var posts: MutableList<Post>,
    private val context: Context,
    private val approveCallback: (String) -> Unit,
    private val rejectCallback: (String) -> Unit
) : RecyclerView.Adapter<PostApprovalAdapter.ViewHolder>() {

    private var exoPlayer: ExoPlayer? = null
    private var currentPlayerView: PlayerView? = null
    private var currentPlayingPosition = -1

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {

        // === SAME IDs AS item_post.xml ===
        val profileImage: ImageView = view.findViewById(R.id.imageProfilePost)
        val username: TextView = view.findViewById(R.id.textUsernamePost)
        val verifiedBadge: ImageView = view.findViewById(R.id.imageVerifiedBadge)
        val timestamp: TextView = view.findViewById(R.id.textTimestampPost)
        val communityName: TextView = view.findViewById(R.id.textCommunityName)

        val postText: TextView = view.findViewById(R.id.textPostContent)
        val postImage: ImageView = view.findViewById(R.id.imagePostContent)
        val audioIcon: LinearLayout = view.findViewById(R.id.audioIcon)

        val playerView: PlayerView? = view.findViewById(R.id.playerView)
        val btnPlayPause: ImageButton? = view.findViewById(R.id.btnPlayPause)

        // APPROVAL BUTTONS
        val approveBtn: Button = view.findViewById(R.id.btnApprove)
        val rejectBtn: Button = view.findViewById(R.id.btnReject)

        fun bind(post: Post, position: Int) {

            // --- Same Feed UI ----
            username.text = post.userId.username
            verifiedBadge.visibility = if (post.userId.verified) View.VISIBLE else View.GONE

            Glide.with(itemView.context)
                .load(post.userId.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(profileImage)

            communityName.text = post.communityId?.displayName ?: "General"
            timestamp.text = post.createdAt
            postText.text = post.caption ?: ""

            // --- MEDIA EXACTLY LIKE FEED ---
            handleMedia(post, position)

            approveBtn.setOnClickListener {
                approveCallback(post._id)
            }

            rejectBtn.setOnClickListener {
                rejectCallback(post._id)
            }
        }

        private fun handleMedia(post: Post, position: Int) {
            val hasImage = !post.imageUrl.isNullOrEmpty()
            val hasVideo = !post.videoUrl.isNullOrEmpty()
            val hasAudio = !post.audioUrl.isNullOrEmpty()

            postImage.visibility = if (hasImage) View.VISIBLE else View.GONE
            audioIcon.visibility = if (hasAudio) View.VISIBLE else View.GONE
            playerView?.visibility = if (hasVideo) View.VISIBLE else View.GONE
            btnPlayPause?.visibility = if (hasVideo) View.VISIBLE else View.GONE

            if (hasImage) {
                Glide.with(context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(postImage)
            }

            if (hasVideo) {
                if (position == currentPlayingPosition) attachPlayer(playerView)
                else playerView?.player = null

                btnPlayPause?.setOnClickListener { toggleVideo(post, position) }
                playerView?.setOnClickListener { toggleVideo(post, position) }
            }

            if (hasAudio) {
                audioIcon.setOnClickListener {
                    val mp = MediaPlayer()
                    mp.setDataSource(post.audioUrl)
                    mp.prepare()
                    mp.start()
                }
            }
        }

        private fun toggleVideo(post: Post, position: Int) {
            if (exoPlayer == null) {
                exoPlayer = ExoPlayer.Builder(context).build()
            }

            if (position != currentPlayingPosition) {
                playVideo(post, position)
                return
            }

            if (exoPlayer!!.isPlaying) exoPlayer!!.pause()
            else exoPlayer!!.play()

            btnPlayPause?.setImageResource(
                if (exoPlayer!!.isPlaying) R.drawable.ic_pause_circle
                else R.drawable.ic_play_circle
            )
        }

        private fun playVideo(post: Post, position: Int) {
            currentPlayingPosition = position

            exoPlayer!!.apply {
                setMediaItem(MediaItem.fromUri(Uri.parse(post.videoUrl)))
                prepare()
                play()
            }

            notifyDataSetChanged()
        }

        private fun attachPlayer(pv: PlayerView?) {
            currentPlayerView?.player = null
            pv?.player = exoPlayer
            currentPlayerView = pv
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_approval, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount() = posts.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(posts[position], position)
    }

    fun updatePosts(list: List<Post>) {
        posts.clear()
        posts.addAll(list)
        notifyDataSetChanged()
    }
}
