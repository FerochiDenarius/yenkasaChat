package com.example.yenkasachat.adapter

import android.content.Context
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post

class PostApprovalAdapter(
    private var posts: MutableList<Post>,
    private val context: Context,
    private val approveCallback: (String) -> Unit,
    private val rejectCallback: (String) -> Unit,
    private val approvedPosts: Int,
    private val followers: Int,
    private val totalComments: Int
) : RecyclerView.Adapter<PostApprovalAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val postImage: ImageView = view.findViewById(R.id.imagePost)
        val playIcon: ImageView = view.findViewById(R.id.playIcon)
        val postText: TextView = view.findViewById(R.id.textContent)
        val approveBtn: Button = view.findViewById(R.id.btnApprove)
        val rejectBtn: Button = view.findViewById(R.id.btnReject)
        val statsText: TextView = view.findViewById(R.id.textStats)
        val audioIndicator: TextView = view.findViewById(R.id.audioIndicator)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_approval, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount() = posts.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val post = posts[position]

        // Debug log
        Log.d("PostApprovalAdapter", "Binding post: ${post._id} | image=${post.imageUrl} | video=${post.videoUrl} | audio=${post.audioUrl}")

        holder.postText.text = post.caption?.ifEmpty { "No caption" } ?: "No caption"

        // Hide all indicators initially
        holder.postImage.visibility = View.GONE
        holder.playIcon.visibility = View.GONE
        holder.audioIndicator.visibility = View.GONE

        // 🔹 Detect media type
        val mediaType = when {
            !post.videoUrl.isNullOrEmpty() -> "video"
            !post.imageUrl.isNullOrEmpty() -> "image"
            !post.audioUrl.isNullOrEmpty() -> "audio"
            else -> "none"
        }

        // 🔹 Handle media rendering
        when (mediaType) {
            "image" -> {
                holder.postImage.visibility = View.VISIBLE
                Glide.with(context)
                    .load(post.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.placeholder_image)
                    .centerCrop()
                    .into(holder.postImage)
            }

            "video" -> {
                holder.postImage.visibility = View.VISIBLE
                holder.playIcon.visibility = View.VISIBLE
                Glide.with(context)
                    .load(post.videoUrl ?: post.imageUrl)
                    .placeholder(R.drawable.placeholder_video)
                    .error(R.drawable.placeholder_video)
                    .centerCrop()
                    .into(holder.postImage)
            }

            "audio" -> {
                holder.audioIndicator.visibility = View.VISIBLE
                holder.audioIndicator.text = "🎧 Audio post"
            }

            else -> {
                holder.postImage.visibility = View.VISIBLE
                holder.postImage.setImageResource(R.drawable.placeholder_image)
            }
        }

        // 🔹 Display admin stats
        holder.statsText.text =
            "Approved: $approvedPosts • Followers: $followers • Comments: $totalComments"

        // 🔹 Approve / Reject buttons
        holder.approveBtn.setOnClickListener {
            Log.d("PostApprovalAdapter", "Approve clicked for ${post._id}")
            approveCallback(post._id)
        }

        holder.rejectBtn.setOnClickListener {
            Log.d("PostApprovalAdapter", "Reject clicked for ${post._id}")
            rejectCallback(post._id)
        }
    }

    fun updatePosts(newPosts: List<Post>) {
        Log.d("PostApprovalAdapter", "Updating post list, new count = ${newPosts.size}")
        posts.clear()
        posts.addAll(newPosts)
        notifyDataSetChanged()
    }
}
