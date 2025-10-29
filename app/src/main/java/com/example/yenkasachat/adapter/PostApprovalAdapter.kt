package com.example.yenkasachat.adapter

import android.content.Context
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
        val postText: TextView = view.findViewById(R.id.textContent)
        val approveBtn: Button = view.findViewById(R.id.btnApprove)
        val rejectBtn: Button = view.findViewById(R.id.btnReject)
        val statsText: TextView = view.findViewById(R.id.textStats)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_pending_post, parent, false)
        return ViewHolder(view)
    }

    override fun getItemCount() = posts.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val post = posts[position]

        // Post content
        holder.postText.text = post.caption ?: "No caption"

        // Load image safely
        Glide.with(context)
            .load(post.mediaUrl)
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.placeholder_image)
            .into(holder.postImage)

        // Display optional admin metrics
        holder.statsText.text = "Approved: $approvedPosts • Followers: $followers • Comments: $totalComments"

        // Button click actions
        holder.approveBtn.setOnClickListener {
            post._id?.let { id -> approveCallback(id) }
        }

        holder.rejectBtn.setOnClickListener {
            post._id?.let { id -> rejectCallback(id) }
        }
    }

    fun updatePosts(newPosts: List<Post>) {
        posts.clear()
        posts.addAll(newPosts)
        notifyDataSetChanged()
    }
}
