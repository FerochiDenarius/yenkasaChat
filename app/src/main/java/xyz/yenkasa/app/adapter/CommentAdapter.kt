package xyz.yenkasa.app.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Comment
import xyz.yenkasa.app.util.TokenManager
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
        fun onLike(comment: Comment, isLiked: Boolean, position: Int)
        fun onUserClicked(userId: String)

    }

    inner class CommentViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val imageUser: ImageView = itemView.findViewById(R.id.imageUser)
        val textUsername: TextView = itemView.findViewById(R.id.textUsername)
        val textComment: TextView = itemView.findViewById(R.id.textComment)
        val textTimestamp: TextView = itemView.findViewById(R.id.textTimestamp)
        val buttonReply: TextView = itemView.findViewById(R.id.buttonReply)
        val buttonEdit: TextView = itemView.findViewById(R.id.buttonEdit)
        val buttonDelete: TextView = itemView.findViewById(R.id.buttonDelete)

        // ✅ new like views
        val buttonLike: ImageView = itemView.findViewById(R.id.buttonLike)
        val textLikeCount: TextView = itemView.findViewById(R.id.textLikeCount)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommentViewHolder {
        val view = LayoutInflater.from(context).inflate(R.layout.item_comment, parent, false)
        return CommentViewHolder(view)
    }

    override fun getItemCount(): Int = comments.size

    override fun onBindViewHolder(holder: CommentViewHolder, position: Int) {
        val comment = comments[position]
        val currentUserId = TokenManager.getUserId(context)

        // Basic info
        holder.textUsername.text = comment.user?.username ?: "Unknown User"
        holder.textComment.text = comment.text ?: ""
        holder.textTimestamp.text = comment.createdAt?.let { formatDate(it) } ?: ""

        // ==========================
// ⭐ USER PROFILE CLICKS
// ==========================
        holder.textUsername.setOnClickListener {
            listener.onUserClicked(comment.user._id)
        }

        holder.imageUser.setOnClickListener {
            listener.onUserClicked(comment.user._id)
        }


        // Profile image
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


        // ✅ Likes display
        val isLiked = comment.likes?.contains(currentUserId) == true
        holder.buttonLike.setImageResource(
            if (isLiked) R.drawable.ic_heart else R.drawable.ic_heart_outline
        )
        holder.textLikeCount.text = maxOf(comment.likeCount, comment.likes.size).toString()

        // ✅ Like click toggle
        holder.buttonLike.setOnClickListener {
            val adapterPosition = holder.bindingAdapterPosition
            if (adapterPosition == RecyclerView.NO_POSITION) return@setOnClickListener

            val liked = comment.likes.contains(currentUserId)
            listener.onLike(comment, !liked, adapterPosition)
        }

        // Reply click
        holder.buttonReply.setOnClickListener { listener.onReply(comment) }

        // Edit/Delete visibility
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

    fun updateComment(updated: Comment) {
        val index = comments.indexOfFirst { it._id == updated._id }
        if (index != -1) {
            comments[index] = updated
            notifyItemChanged(index)
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
