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
import com.example.yenkasachat.util.TokenManager
import java.text.SimpleDateFormat
import java.util.*

class CommentAdapter(
    private val context: Context,
    private val comments: MutableList<Comment>,
    private val listener: CommentActionListener
) : RecyclerView.Adapter<CommentAdapter.CommentViewHolder>() {

    interface CommentActionListener {
        fun onReply(comment: Comment)
        fun onEdit(comment: Comment)
        fun onDelete(comment: Comment)
    }

    inner class CommentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageUser: ImageView = itemView.findViewById(R.id.imageUser)
        val textUsername: TextView = itemView.findViewById(R.id.textUsername)
        val textComment: TextView = itemView.findViewById(R.id.textComment)
        val textTimestamp: TextView = itemView.findViewById(R.id.textTimestamp)
        val buttonReply: TextView = itemView.findViewById(R.id.buttonReply)
        val buttonEdit: TextView = itemView.findViewById(R.id.buttonEdit)
        val buttonDelete: TextView = itemView.findViewById(R.id.buttonDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_comment, parent, false)
        return CommentViewHolder(view)
    }
    // Inside CommentAdapter
    fun updateComment(updated: Comment) {
        val index = comments.indexOfFirst { it._id == updated._id }
        if (index != -1) {
            comments[index] = updated
            notifyItemChanged(index)
        }
    }

    override fun getItemCount(): Int = comments.size

    override fun onBindViewHolder(holder: CommentViewHolder, position: Int) {
        val comment = comments[position]

        // Set username, comment text, timestamp
        holder.textUsername.text = comment.user?.username ?: "Unknown User"
        holder.textComment.text = comment.text ?: ""
        holder.textTimestamp.text = comment.createdAt?.let { formatDate(it) } ?: ""

        // Load profile image
        val profileUrl = comment.user?.profileImage
        if (!profileUrl.isNullOrBlank()) {
            Glide.with(context)
                .load(profileUrl)
                .apply(
                    RequestOptions()
                        .placeholder(R.drawable.ic_user_placeholder)
                        .error(R.drawable.ic_user_placeholder)
                        .circleCrop()
                )
                .into(holder.imageUser)
        } else {
            holder.imageUser.setImageResource(R.drawable.ic_user_placeholder)
        }

        // Reply click
        holder.buttonReply.setOnClickListener { listener.onReply(comment) }

        // Only show Edit/Delete if comment belongs to current user
        val currentUserId = TokenManager.getUserId(context)
        if (comment.user?._id == currentUserId) {
            holder.buttonEdit.visibility = View.VISIBLE
            holder.buttonEdit.setOnClickListener { listener.onEdit(comment) }

            holder.buttonDelete.visibility = View.VISIBLE
            holder.buttonDelete.setOnClickListener { listener.onDelete(comment) }
        } else {
            holder.buttonEdit.visibility = View.GONE
            holder.buttonDelete.visibility = View.GONE
        }
    }

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


    fun deleteComment(comment: Comment) {
        val index = comments.indexOfFirst { it._id == comment._id }
        if (index != -1) {
            comments.removeAt(index)
            notifyItemRemoved(index)
        }
    }
}
