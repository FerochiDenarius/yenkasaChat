package xyz.yenkasa.app.adapter

import android.content.Context
import android.media.MediaPlayer
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.PostApprovalItem
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.UserBadgeUtils


class PostApprovalAdapter(
    private var items: MutableList<PostApprovalItem>,
    private val context: Context,
    private val approveCallback: (String) -> Unit,
    private val rejectCallback: (String) -> Unit
) : RecyclerView.Adapter<PostApprovalAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {

        // === SAME IDs AS item_post.xml ===
        val profileImage: ImageView = view.findViewById(R.id.imageProfilePost)
        val username: TextView = view.findViewById(R.id.textUsernamePost)
        val verifiedBadge: ImageView = view.findViewById(R.id.imageVerifiedBadge)
        val timestamp: TextView = view.findViewById(R.id.textTimestampPost)
        val communityName: TextView = view.findViewById(R.id.textCommunityName)

        val postText: TextView = view.findViewById(R.id.textPostContent)
        val mediaContainer: FrameLayout = view.findViewById(R.id.mediaContainer)
        val textBackgroundPost: TextView = view.findViewById(R.id.textPostBackgroundContent)
        val postImage: ImageView = view.findViewById(R.id.imagePostContent)
        val audioIcon: LinearLayout = view.findViewById(R.id.audioIcon)

        val playerView: YenkasaVideoPlayerView? = view.findViewById(R.id.playerView)
        val btnPlayPause: ImageButton? = view.findViewById(R.id.btnPlayPause)

        // APPROVAL BUTTONS
        val approveBtn: Button = view.findViewById(R.id.btnApprove)
        val rejectBtn: Button = view.findViewById(R.id.btnReject)


        fun bind(item: PostApprovalItem, position: Int) {

            val post = item.post

            // --- Same Feed UI ----
            username.text = post.userId.username
            UserBadgeUtils.applyBadge(
                verifiedBadge,
                post.userId.verified,
                post.userId.roleName
            )

            Glide.with(itemView.context)
                .load(post.userId.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(profileImage)

            communityName.text = post.communityId?.displayName ?: "General"
            timestamp.text = post.createdAt

            handleMedia(post, position)

            approveBtn.setOnClickListener {
                approveCallback(item._id)
            }

            rejectBtn.setOnClickListener {
                rejectCallback(item._id)
            }
        }


        private fun handleMedia(post: Post, position: Int) {
            val hasImage = !post.imageUrl.isNullOrEmpty()
            val hasVideo = !post.videoUrl.isNullOrEmpty()
            val hasAudio = !post.audioUrl.isNullOrEmpty()
            val hasMedia = hasImage || hasVideo || hasAudio
            val hasTextBackground = !hasMedia &&
                !post.caption.isNullOrBlank() &&
                TextPostBackgrounds.normalize(post.textBackgroundColor).isNotBlank()

            mediaContainer.visibility = if (hasMedia || hasTextBackground) View.VISIBLE else View.GONE
            postImage.visibility = if (hasImage) View.VISIBLE else View.GONE
            audioIcon.visibility = if (hasAudio) View.VISIBLE else View.GONE
            playerView?.visibility = if (hasVideo) View.VISIBLE else View.GONE
            btnPlayPause?.visibility = View.GONE
            textBackgroundPost.visibility = if (hasTextBackground) View.VISIBLE else View.GONE

            postText.text = post.caption.orEmpty()
            postText.visibility = if (post.caption.isNullOrBlank() || hasTextBackground) View.GONE else View.VISIBLE

            if (hasTextBackground) {
                textBackgroundPost.text = post.caption.orEmpty()
                TextPostBackgrounds.apply(textBackgroundPost, post.textBackgroundColor.orEmpty())
            }

            if (hasImage) {
                Glide.with(context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(postImage)
            }

            if (hasVideo) {
                val videoUrl = post.optimizedVideoUrl() ?: post.videoUrl
                val thumbnailUrl = post.optimizedVideoPosterUrl()
                playerView?.bindVideo(
                    mediaUrl = videoUrl,
                    thumbnailUrl = thumbnailUrl,
                    autoplay = false,
                    muted = true
                )
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

        fun releaseVideo() {
            playerView?.release()
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_approval, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position], position)
    }

    override fun onViewRecycled(holder: ViewHolder) {
        holder.releaseVideo()
        super.onViewRecycled(holder)
    }

    override fun onViewDetachedFromWindow(holder: ViewHolder) {
        holder.playerView?.pause()
        super.onViewDetachedFromWindow(holder)
    }


    fun updateItems(list: List<PostApprovalItem>) {
        items.clear()
        items.addAll(list)
        notifyDataSetChanged()
    }
}
