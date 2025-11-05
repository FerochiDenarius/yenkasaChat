package com.example.yenkasachat.adapter

import android.text.SpannableString
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.util.Log
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
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
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
            timestamp.text = formatTimestamp(post.createdAt)
            postText.text = highlightMentions(post.caption, post.mentions)

            handleMedia(post)

            likeCount.text = "${post.likeCount} likes"
            commentCount.text = "${post.commentCount} comments"

            coinsEarned.visibility = if (post.coinsEarned > 0) {
                coinsEarned.text = "🪙 ${post.coinsEarned} coins earned"
                View.VISIBLE
            } else View.GONE

            updateLikeButton(post.likedByCurrentUser)

            btnLike.setOnClickListener { onLikeClick(post, position) }
            btnComment.setOnClickListener { onCommentClick(post, position) }
            btnShare.setOnClickListener { onShareClick(post) }

            // ✅ FIXED: Removed 'holder' – use itemView directly
            itemView.setOnClickListener {
                onPostClick(post)

                // 👁️ Record a view when the post is opened (safe coroutine scope)
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        val token = TokenManager.getToken(itemView.context)
                        if (!token.isNullOrEmpty()) {
                            val response = ApiClient.apiService.recordView(post._id, "Bearer $token")
                            if (response.isSuccessful) {
                                Log.d("PostAdapter", "✅ View recorded for ${post._id}")
                            } else {
                                Log.w("PostAdapter", "⚠️ Failed to record view: ${response.errorBody()?.string()}")
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("PostAdapter", "❌ Error recording view: ${e.message}")
                    }
                }
            }
        }

        private fun handleMedia(post: Post) {
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
                    else -> SimpleDateFormat("MMM dd", Locale.getDefault()).format(date ?: Date())
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
        if (position in posts.indices) {
            val updatedPost = posts[position].copy(
                likedByCurrentUser = isLiked,
                likeCount = likeCount
            )
            (posts as? MutableList<Post>)?.set(position, updatedPost)
            notifyItemChanged(position)
        }
    }
}
