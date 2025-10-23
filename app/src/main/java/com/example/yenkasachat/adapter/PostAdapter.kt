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
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class PostAdapter(private val posts: MutableList<Post>) :
    RecyclerView.Adapter<PostAdapter.PostViewHolder>() {

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

        // Like info
        val likeCount = post.likes?.size ?: 0
        holder.textLikes.text = "$likeCount likes"

        holder.buttonLike.setOnClickListener {
            toggleLike(post, holder)
        }

        // Reset visibility
        holder.imagePost.visibility = View.GONE
        holder.videoPost.visibility = View.GONE
        holder.audioPlayButton.visibility = View.GONE
        holder.textCaption.visibility = View.GONE

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

                // 🖼️ FIXED — check for null before using mediaUrl
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

                // 🎥 FIXED — only parse if not null
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

                // 🎧 FIXED — only start if URL exists
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

    private fun toggleLike(post: Post, holder: PostViewHolder) {
        val context = holder.itemView.context
        val token = TokenManager.getToken(context)

        if (token.isNullOrEmpty()) {
            Toast.makeText(context, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        // Safely get the post ID. If it's null, show an error message and stop.
        val postId = post._id
        if (postId == null) {
            Toast.makeText(context, "Cannot like post, ID is missing.", Toast.LENGTH_SHORT).show()
            return // Stop the function here
        }

        // At this point, 'postId' is guaranteed to be a non-null String
        ApiClient.apiService.toggleLike(postId)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val data = response.body()
                        val liked = data?.get("likedByUser") as? Boolean ?: false
                        val likesCount = (data?.get("likesCount") as? Double)?.toInt() ?: 0

                        holder.buttonLike.setImageResource(
                            if (liked) R.drawable.ic_heart_filled else R.drawable.ic_heart_outline
                        )
                        holder.textLikes.text = "$likesCount likes"
                    } else {
                        Toast.makeText(context, "Failed to like post", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
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
