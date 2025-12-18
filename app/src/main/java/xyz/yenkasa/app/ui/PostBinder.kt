package xyz.yenkasa.app.ui

import android.content.Context
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import java.text.SimpleDateFormat
import java.util.*
import android.widget.ImageButton


object PostBinder {

    fun bind(
        context: Context,
        root: View,
        post: Post,
        onUserClick: ((String) -> Unit)? = null
    ) {

        // Header
        val profileImage = root.findViewById<ImageView>(R.id.imageProfilePost)
        val username = root.findViewById<TextView>(R.id.textUsernamePost)
        val verifiedBadge = root.findViewById<ImageView>(R.id.imageVerifiedBadge)
        val communityName = root.findViewById<TextView>(R.id.textCommunityName)
        val timestamp = root.findViewById<TextView>(R.id.textTimestampPost)

        val postText = root.findViewById<TextView>(R.id.textPostContent)
        val likeCount = root.findViewById<TextView>(R.id.textLikeCount)
        val commentCount = root.findViewById<TextView>(R.id.textCommentCount)
        val viewCount = root.findViewById<TextView>(R.id.textViewCount)

        val postImage = root.findViewById<ImageView>(R.id.imagePostContent)
        val playerView = root.findViewById<PlayerView>(R.id.playerView)
        val audioIcon = root.findViewById<LinearLayout>(R.id.audioIcon)

        // 🔁 FULL reset (match PostAdapter)
        postImage.visibility = View.GONE
        playerView.visibility = View.GONE
        root.findViewById<ImageView>(R.id.imageVideoThumbnail)?.visibility = View.GONE
        val btnVideoPlay = root.findViewById<ImageButton>(R.id.btnVideoPlay)
        val btnPlayPause = root.findViewById<ImageButton>(R.id.btnPlayPause)

        btnVideoPlay?.visibility = View.GONE
        btnPlayPause?.visibility = View.GONE

        audioIcon.visibility = View.GONE

        // 👤 User
        username.text = post.userId.username
        verifiedBadge.visibility =
            if (post.userId.verified) View.VISIBLE else View.GONE

        Glide.with(context)
            .load(post.userId.profileImage)
            .placeholder(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(profileImage)

        onUserClick?.let {
            profileImage.setOnClickListener { it(post.userId.id) }
            username.setOnClickListener { it(post.userId.id) }
        }

        // 🏘 Community
        communityName.text = post.communityId?.displayName ?: "General"

        // 🕒 Timestamp (SAFE)
        val ts = post.createdAt.toLongOrNull()
        timestamp.text = if (ts != null)
            SimpleDateFormat("dd MMM • hh:mm a", Locale.getDefault()).format(Date(ts))
        else ""

        // 📝 Text + stats
        postText.text = post.caption.orEmpty()
        likeCount.text = "${post.likeCount} likes"
        commentCount.text = "${post.commentCount} comments"
        viewCount.text = "👁 ${post.viewCount}"

        // 🎬 Media (same order as PostAdapter)
        when {
            !post.imageUrl.isNullOrEmpty() -> {
                postImage.visibility = View.VISIBLE
                Glide.with(context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(postImage)
            }

            !post.videoUrl.isNullOrEmpty() -> {
                playerView.visibility = View.VISIBLE
            }

            !post.audioUrl.isNullOrEmpty() -> {
                audioIcon.visibility = View.VISIBLE
            }
        }
    }
}
