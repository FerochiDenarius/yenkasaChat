package xyz.yenkasa.app.adapter

import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.ui.PostBinder
import android.util.Log

class PostHeaderAdapter(
    private val headerView: View,
    private var post: Post? = null,
    private val onUserClick: (String) -> Unit
) : RecyclerView.Adapter<PostHeaderAdapter.HeaderVH>() {

    inner class HeaderVH(view: View) : RecyclerView.ViewHolder(view)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HeaderVH {
        return HeaderVH(headerView)
    }

    override fun onBindViewHolder(holder: HeaderVH, position: Int) {
        post?.let {
            PostBinder.bind(
                context = holder.itemView.context,
                root = holder.itemView,
                post = it,
                onUserClick = onUserClick
            )
        }
    }
    fun updateCommentCount(count: Int) {
        post = post?.copy(commentCount = count)
        notifyItemChanged(0)
    }

    override fun getItemCount(): Int {
        Log.d("PostHeaderAdapter", "itemCount = ${if (post == null) 0 else 1}")
        return if (post == null) 0 else 1
    }



    fun submitPost(post: Post) {
        Log.d("PostHeaderAdapter", "submitPost CALLED with postId=${post._id}")
        val hadPost = this.post != null
        this.post = post

        if (hadPost) notifyItemChanged(0)
        else notifyItemInserted(0)
    }
}
