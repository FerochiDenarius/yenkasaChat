package com.example.yenkasachat.adapter

import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.ui.CommentsActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class PostAdapter(private val posts: MutableList<Post>) :
    RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

    // Track pending like requests to avoid duplicate calls for the same post
    private val pendingLikes = mutableSetOf<String>()
    private val viewedPosts = mutableSetOf<String>()


    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageUser: ImageView = itemView.findViewById(R.id.imageUser)
        val textUser: TextView = itemView.findViewById(R.id.textUser)
        val textCaption: TextView = itemView.findViewById(R.id.textCaption)
        val imagePost: ImageView = itemView.findViewById(R.id.imagePost)
        val videoPost: VideoView = itemView.findViewById(R.id.videoPost)
        val audioPlayButton: ImageButton = itemView.findViewById(R.id.audioPlayButton)
        val buttonLike: ImageButton = itemView.findViewById(R.id.buttonLike)
        val textLikes: TextView = itemView.findViewById(R.id.textLikes)
        val textTimestamp: TextView = itemView.findViewById(R.id.textTimestamp)
        val textComments: TextView = itemView.findViewById(R.id.textComments)
        val textViews: TextView = itemView.findViewById(R.id.textViews)

    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]

        // User info
        holder.textUser.text = post.user?.username ?: "Anonymous"
        val profileUrl = post.user?.profileImage
        if (!profileUrl.isNullOrBlank()) {
            Glide.with(holder.itemView.context)
                .load(profileUrl)
                .placeholder(R.drawable.ic_user_placeholder)
                .error(R.drawable.ic_user_placeholder)
                .circleCrop()
                .into(holder.imageUser)
        } else {
            holder.imageUser.setImageResource(R.drawable.ic_user_placeholder)
        }

        // Timestamp
        holder.textTimestamp.text = post.createdAt?.let { formatDate(it) } ?: ""

        // Like info - drive UI from model
        holder.textLikes.text = "${post.likesCount} likes"
        holder.buttonLike.setImageResource(
            if (post.likedByUser) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline
        )

        // Comments and views
        holder.textComments.text = "${post.commentsCount ?: 0} comments"
        holder.textViews.text = "${post.viewsCount ?: 0} views"

        // 💬 Open CommentsActivity when user taps comments count
        holder.textComments.setOnClickListener {
            val intent = Intent(holder.itemView.context, CommentsActivity::class.java)
            intent.putExtra("POST_ID", post._id)
            holder.itemView.context.startActivity(intent)
        }

        // Click listener uses adapterPosition and updates model optimistically
        holder.buttonLike.setOnClickListener {
            val pos = holder.adapterPosition
            if (pos == RecyclerView.NO_POSITION) return@setOnClickListener
            val currentPost = posts[pos]
            toggleLike(currentPost, pos, holder)
        }

        // Reset visibility
        holder.imagePost.visibility = View.GONE
        holder.videoPost.visibility = View.GONE
        holder.audioPlayButton.visibility = View.GONE
        holder.textCaption.visibility = View.GONE
        markPostAsViewed(holder.itemView.context, post)

        when (post.mediaType) {
            "text" -> {
                holder.textCaption.visibility = View.VISIBLE
                holder.textCaption.text = post.caption ?: ""
            }

            "image" -> {
                holder.imagePost.visibility = View.VISIBLE
                Glide.with(holder.itemView.context)
                    .load(post.mediaUrl)
                    .apply(RequestOptions().placeholder(R.drawable.placeholder).error(R.drawable.placeholder))
                    .into(holder.imagePost)

                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility =
                    if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE

                holder.imagePost.setOnClickListener {
                    post.mediaUrl?.let { url ->
                        openPreview(holder.itemView.context, url)
                    } ?: run {
                        Toast.makeText(holder.itemView.context, "No media to preview", Toast.LENGTH_SHORT).show()
                    }
                }
            }

            "video" -> {
                holder.videoPost.visibility = View.VISIBLE
                post.mediaUrl?.let { url ->
                    holder.videoPost.setVideoURI(Uri.parse(url))
                    holder.videoPost.setOnPreparedListener { it.isLooping = true }
                    holder.videoPost.start()
                }

                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility =
                    if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE
            }

            "audio" -> {
                holder.audioPlayButton.visibility = View.VISIBLE
                holder.textCaption.text = post.caption ?: ""
                holder.textCaption.visibility =
                    if (!post.caption.isNullOrBlank()) View.VISIBLE else View.GONE

                holder.audioPlayButton.setOnClickListener {
                    post.mediaUrl?.let { url ->
                        val mediaPlayer = MediaPlayer().apply {
                            setDataSource(url)
                            prepare()
                            start()
                        }
                        holder.audioPlayButton.setImageResource(R.drawable.ic_pause)
                        mediaPlayer.setOnCompletionListener {
                            holder.audioPlayButton.setImageResource(R.drawable.ic_play)
                            mediaPlayer.release()
                        }
                    } ?: run {
                        Toast.makeText(holder.itemView.context, "Audio unavailable", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    override fun getItemCount(): Int = posts.size

    /**
     * Toggle like state with optimistic UI, dedupe in-flight requests, and safe response parsing.
     *
     * NOTE: Your ApiService must accept an Authorization header, e.g.:
     * @POST("social/like/{postId}") fun toggleLike(@Header("Authorization") auth: String, @Path("postId") postId: String): Call<Map<String, Any>>
     *
     * If toggleLike currently doesn't accept a header, either update ApiService or add an OkHttp interceptor that attaches the Bearer token.
     */
    private fun toggleLike(post: Post, position: Int, holder: PostViewHolder) {
        val context = holder.itemView.context
        val token = TokenManager.getToken(context)

        if (token.isNullOrEmpty()) {
            Toast.makeText(context, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        val postId = post._id
        if (postId.isNullOrEmpty()) {
            Toast.makeText(context, "Cannot like post, ID is missing.", Toast.LENGTH_SHORT).show()
            return
        }

        // If there's already a pending request for this post, ignore further taps
        synchronized(pendingLikes) {
            if (pendingLikes.contains(postId)) return
            pendingLikes.add(postId)
        }

        // Optimistic update
        val previousLiked = post.likedByUser
        val previousCount = post.likesCount
        val newLiked = !previousLiked
        post.likedByUser = newLiked
        post.likesCount = if (newLiked) previousCount + 1 else (previousCount - 1).coerceAtLeast(0)
        notifyItemChanged(position)

        // Make network request. Send token as "Bearer <token>" (backend verifies it)
        ApiClient.apiService.toggleLike("Bearer $token", postId)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    synchronized(pendingLikes) { pendingLikes.remove(postId) }

                    if (response.isSuccessful) {
                        val data = response.body()
                        // Defensive parsing
                        val liked = parseBoolean(data?.get("likedByUser")) ?: newLiked
                        val likesCount = parseInt(data?.get("likesCount")) ?: post.likesCount

                        // Update model with server authoritative values
                        post.likedByUser = liked
                        post.likesCount = likesCount
                        // Notify the specific item so the UI reflects server state
                        notifyItemChanged(position)
                    } else {
                        // Revert optimistic update on failure
                        post.likedByUser = previousLiked
                        post.likesCount = previousCount
                        notifyItemChanged(position)
                        Toast.makeText(context, "Failed to update like", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    synchronized(pendingLikes) { pendingLikes.remove(postId) }

                    // revert optimistic update
                    post.likedByUser = previousLiked
                    post.likesCount = previousCount
                    notifyItemChanged(position)
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // Helper: robust boolean parser for Map<String, Any> responses
    private fun parseBoolean(value: Any?): Boolean? {
        return when (value) {
            is Boolean -> value
            is String -> value.equals("true", ignoreCase = true)
            is Number -> value.toInt() != 0
            else -> null
        }
    }
    private fun markPostAsViewed(context: Context, post: Post) {
        val postId = post._id ?: return
        if (viewedPosts.contains(postId)) return  // Already tracked this post

        val token = TokenManager.getToken(context)
        if (token.isNullOrEmpty()) return

        viewedPosts.add(postId)

        ApiClient.apiService.addView("Bearer $token", postId)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val data = response.body()
                        val newViews = (data?.get("viewsCount") as? Number)?.toInt() ?: post.viewsCount
                        post.viewsCount = newViews
                        notifyItemChanged(posts.indexOf(post))
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    // Fail silently; not critical
                }
            })
    }

    // Helper: robust int parser for Map<String, Any> responses
    private fun parseInt(value: Any?): Int? {
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull()
            else -> null
        }
    }

    private fun openPreview(context: Context, mediaUrl: String?) {
        if (mediaUrl.isNullOrEmpty()) return
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(mediaUrl))
        context.startActivity(intent)
    }

    private fun formatDate(timestamp: String): String {
        return try {
            val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            input.timeZone = TimeZone.getTimeZone("UTC")
            val date = input.parse(timestamp)
            val output = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
            output.format(date!!)
        } catch (e: Exception) {
            ""
        }
    }
}