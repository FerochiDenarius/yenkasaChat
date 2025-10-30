// app/src/main/java/com/example/yenkasachat/adapter/PostAdapter.kt
package com.example.yenkasachat.adapter

import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import java.text.SimpleDateFormat
import java.util.*

class PostAdapter(
    private var posts: List<Post>,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit
) : RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val profileImage: ImageView = itemView.findViewById(R.id.imageProfilePost)
        val username: TextView = itemView.findViewById(R.id.textUsernamePost)
        val verifiedBadge: ImageView = itemView.findViewById(R.id.imageVerifiedBadge)
        val timestamp: TextView = itemView.findViewById(R.id.textTimestampPost)
        val communityName: TextView = itemView.findViewById(R.id.textCommunityName)

        val postText: TextView = itemView.findViewById(R.id.textPostContent)
        val postImage: ImageView = itemView.findViewById(R.id.imagePostContent)
        val mediaRecycler: RecyclerView? = itemView.findViewById(R.id.recyclerMediaList)

        val btnLike: ImageButton = itemView.findViewById(R.id.btnLike)
        val btnComment: ImageButton = itemView.findViewById(R.id.btnComment)
        val btnShare: ImageButton = itemView.findViewById(R.id.btnShare)

        val likeCount: TextView = itemView.findViewById(R.id.textLikeCount)
        val commentCount: TextView = itemView.findViewById(R.id.textCommentCount)
        val coinsEarned: TextView = itemView.findViewById(R.id.textCoinsEarned)

        fun bind(post: Post, position: Int) {
            // === User Info ===
            username.text = post.userId.username
            verifiedBadge.visibility = if (post.userId.verified) View.VISIBLE else View.GONE

            Glide.with(itemView.context)
                .load(post.userId.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(profileImage)

            // === Community ===
            communityName.text = post.communityId.displayName

            // === Timestamp ===
            timestamp.text = formatTimestamp(post.createdAt)

            // === Content & Mentions ===
            postText.text = highlightMentions(post.text ?: "", post.mentions)

            // === Media Handling ===
            handleMediaDisplay(post)

            // === Engagement Stats ===
            likeCount.text = "${post.likeCount} likes"
            commentCount.text = "${post.commentCount} comments"

            if (post.coinsEarned > 0) {
                coinsEarned.visibility = View.VISIBLE
                coinsEarned.text = "🪙 ${post.coinsEarned} coins earned"
            } else {
                coinsEarned.visibility = View.GONE
            }

            // === Like Button State ===
            updateLikeButton(post.likedByCurrentUser)

            // === Click Listeners ===
            btnLike.setOnClickListener { onLikeClick(post, position) }
            btnComment.setOnClickListener { onCommentClick(post) }
            btnShare.setOnClickListener { /* TODO: Share logic */ }

            profileImage.setOnClickListener { onUserClick(post.userId.id) }
            username.setOnClickListener { onUserClick(post.userId.id) }
            itemView.setOnClickListener { onPostClick(post) }
        }

        private fun handleMediaDisplay(post: Post) {
            // Handle multiple media (new field)
            val mediaList = post.mediaUrls ?: emptyList()

            if (mediaList.isNotEmpty()) {
                postImage.visibility = View.GONE
                mediaRecycler?.apply {
                    visibility = View.VISIBLE
                    layoutManager = LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
                    adapter = PostMediaAdapter(mediaList)
                }
            } else if (!post.imageUrl.isNullOrEmpty()) {
                mediaRecycler?.visibility = View.GONE
                postImage.visibility = View.VISIBLE
                Glide.with(itemView.context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.placeholder_image)
                    .into(postImage)
            } else {
                postImage.visibility = View.GONE
                mediaRecycler?.visibility = View.GONE
            }
        }

        private fun updateLikeButton(isLiked: Boolean) {
            if (isLiked) {
                btnLike.setImageResource(R.drawable.ic_heart_filled)
                btnLike.setColorFilter(ContextCompat.getColor(itemView.context, R.color.red))
            } else {
                btnLike.setImageResource(R.drawable.ic_heart_outline)
                btnLike.setColorFilter(ContextCompat.getColor(itemView.context, R.color.gray))
            }
        }

        private fun formatTimestamp(timestamp: String): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(timestamp)
                val now = Date()
                val diff = now.time - (date?.time ?: 0)
                when {
                    diff < 60000 -> "Just now"
                    diff < 3600000 -> "${diff / 60000}m ago"
                    diff < 86400000 -> "${diff / 3600000}h ago"
                    diff < 604800000 -> "${diff / 86400000}d ago"
                    else -> {
                        val outputFormat = SimpleDateFormat("MMM dd", Locale.getDefault())
                        outputFormat.format(date ?: Date())
                    }
                }
            } catch (e: Exception) {
                timestamp
            }
        }

        private fun highlightMentions(text: String, mentions: List<String>?): SpannableString {
            val spannable = SpannableString(text)
            mentions?.forEach { username ->
                val startIndex = text.indexOf("@$username")
                if (startIndex >= 0) {
                    spannable.setSpan(
                        ForegroundColorSpan(ContextCompat.getColor(itemView.context, R.color.blue)),
                        startIndex,
                        startIndex + username.length + 1,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    )
                }
            }
            return spannable
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
        if (position < posts.size) {
            val updatedPost = posts[position].copy(
                likedByCurrentUser = isLiked,
                likeCount = likeCount
            )
            posts = posts.toMutableList().apply { set(position, updatedPost) }
            notifyItemChanged(position)
        }
    }
}
