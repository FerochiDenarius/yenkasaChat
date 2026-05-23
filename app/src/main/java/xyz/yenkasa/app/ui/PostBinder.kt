package xyz.yenkasa.app.ui

import android.content.Context
import android.content.res.ColorStateList
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.CloudinaryMedia
import xyz.yenkasa.app.util.TextPostBackgrounds
import xyz.yenkasa.app.util.UserBadgeUtils
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
        val shareCount = root.findViewById<TextView>(R.id.textShareCount)
        val viewCount = root.findViewById<TextView>(R.id.textViewCount)
        val likeButton = root.findViewById<ImageButton>(R.id.btnLike)

        val mediaContainer = root.findViewById<FrameLayout>(R.id.mediaContainer)
        val textBackgroundPost = root.findViewById<TextView>(R.id.textPostBackgroundContent)
        val postImage = root.findViewById<ImageView>(R.id.imagePostContent)
        val playerView = root.findViewById<YenkasaVideoPlayerView>(R.id.playerView)
        val audioIcon = root.findViewById<LinearLayout>(R.id.audioIcon)

        // 🔁 FULL reset (match PostAdapter)
        mediaContainer.visibility = View.GONE
        postImage.visibility = View.GONE
        playerView.visibility = View.GONE
        playerView.release()
        textBackgroundPost.visibility = View.GONE
        root.findViewById<ImageView>(R.id.imageVideoThumbnail)?.visibility = View.GONE
        val btnVideoPlay = root.findViewById<ImageButton>(R.id.btnVideoPlay)
        val btnPlayPause = root.findViewById<ImageButton>(R.id.btnPlayPause)

        btnVideoPlay?.visibility = View.GONE
        btnPlayPause?.visibility = View.GONE

        audioIcon.visibility = View.GONE

        // 👤 User
        username.text = post.userId.username
        UserBadgeUtils.applyBadge(
            verifiedBadge,
            post.userId.verified,
            post.userId.roleName
        )

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
        communityName.text = post.communityId?.displayName ?: context.getString(R.string.general)

        // 🕒 Timestamp (SAFE)
        val ts = post.createdAt.toLongOrNull()
        timestamp.text = if (ts != null)
            SimpleDateFormat("dd MMM • hh:mm a", Locale.getDefault()).format(Date(ts))
        else ""

        val hasImage = !post.imageUrl.isNullOrEmpty()
        val hasVideo = !post.videoUrl.isNullOrEmpty()
        val hasAudio = !post.audioUrl.isNullOrEmpty()
        val hasMedia = hasImage || hasVideo || hasAudio
        val hasTextBackground = !hasMedia &&
            !post.caption.isNullOrBlank() &&
            TextPostBackgrounds.normalize(post.textBackgroundColor).isNotBlank()

        // 📝 Text + stats
        postText.text = post.caption.orEmpty()
        postText.visibility = if (post.caption.isNullOrBlank() || hasTextBackground) {
            View.GONE
        } else {
            View.VISIBLE
        }
        likeCount.text = context.resources.getQuantityString(R.plurals.likes_count, post.likeCount, post.likeCount)
        val resolvedCommentCount = post.resolvedCommentCount()
        commentCount.text = context.resources.getQuantityString(
            R.plurals.comments_count,
            resolvedCommentCount,
            resolvedCommentCount
        )
        shareCount.text = context.resources.getQuantityString(
            R.plurals.shares_count,
            post.shareCount,
            post.shareCount
        )
        viewCount.text = context.getString(R.string.views_count, post.viewCount)
        likeButton.setImageResource(if (post.likedByUser) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline)
        likeButton.imageTintList = ColorStateList.valueOf(
            ContextCompat.getColor(context, R.color.yenkasa_emerald)
        )

        mediaContainer.visibility = if (hasMedia || hasTextBackground) View.VISIBLE else View.GONE
        if (hasTextBackground) {
            textBackgroundPost.text = post.caption.orEmpty()
            textBackgroundPost.visibility = View.VISIBLE
            TextPostBackgrounds.apply(textBackgroundPost, post.textBackgroundColor.orEmpty())
        }

        // 🎬 Media (same order as PostAdapter)
        when {
            hasImage -> {
                mediaContainer.visibility = View.VISIBLE
                postImage.visibility = View.VISIBLE
                Glide.with(context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(postImage)
            }

            hasVideo -> {
                mediaContainer.visibility = View.VISIBLE
                playerView.visibility = View.VISIBLE
                val videoUrl = post.optimizedVideoUrl() ?: post.videoUrl
                playerView.bindVideo(
                    mediaUrl = videoUrl,
                    thumbnailUrl = CloudinaryMedia.videoPosterUrl(videoUrl, CloudinaryMedia.WIDTH_PREVIEW),
                    autoplay = false,
                    muted = true
                )
            }

            hasAudio -> {
                mediaContainer.visibility = View.VISIBLE
                audioIcon.visibility = View.VISIBLE
            }
        }
    }
}
