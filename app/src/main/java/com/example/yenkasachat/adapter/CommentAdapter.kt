package com.example.yenkasachat.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Comment
import java.text.SimpleDateFormat
import java.util.*

class CommentAdapter(
    private val context: Context,
    private val comments: MutableList<Comment>
) : RecyclerView.Adapter<CommentAdapter.CommentViewHolder>() {

    inner class CommentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageUser: ImageView = itemView.findViewById(R.id.imageUser)
        val textUsername: TextView = itemView.findViewById(R.id.textUsername)
        val textComment: TextView = itemView.findViewById(R.id.textComment)
        val textTimestamp: TextView = itemView.findViewById(R.id.textTimestamp)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_comment, parent, false)
        return CommentViewHolder(view)
    }

    override fun getItemCount(): Int = comments.size

    override fun onBindViewHolder(holder: CommentViewHolder, position: Int) {
        val comment = comments[position]

        holder.textUsername.text = comment.user?.username ?: "Unknown User"
        holder.textComment.text = comment.text ?: ""

        // Format the timestamp
        holder.textTimestamp.text = comment.createdAt?.let { formatDate(it) } ?: ""

        // Load profile image
        val profileUrl = comment.user?.profileImage
        if (!profileUrl.isNullOrBlank()) {
            Glide.with(context)
                .load(profileUrl)
                .apply(
                    RequestOptions()
                        .placeholder(R.drawable.ic_contact)
                        .error(R.drawable.ic_user_placeholder)
                        .circleCrop()
                )
                .into(holder.imageUser)
        } else {
            holder.imageUser.setImageResource(R.drawable.ic_user_placeholder)
        }
    }

    // Optional helper to format ISO timestamps to readable text
    private fun formatDate(timestamp: String): String {
        return try {
            val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            inputFormat.timeZone = TimeZone.getTimeZone("UTC")
            val date = inputFormat.parse(timestamp)
            val outputFormat = SimpleDateFormat("MMM d, h:mm a", Locale.getDefault())
            outputFormat.format(date!!)
        } catch (e: Exception) {
            ""
        }
    }

    fun addComment(newComment: Comment) {
        comments.add(0, newComment)
        notifyItemInserted(0)
    }

    fun setComments(newList: List<Comment>) {
        comments.clear()
        comments.addAll(newList)
        notifyDataSetChanged()
    }
}
