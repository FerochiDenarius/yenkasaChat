package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post

class ProfilePostAdapter(private val posts: List<Post>) :
    RecyclerView.Adapter<ProfilePostAdapter.PostViewHolder>() {

    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val postImage: ImageView = itemView.findViewById(R.id.imagePostPreview)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_preview, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]

        // Pick the right thumbnail source — image, video, or audio
        val thumbnailUrl = when {
            !post.imageUrl.isNullOrEmpty() -> post.imageUrl
            !post.videoUrl.isNullOrEmpty() -> post.videoUrl
            !post.audioUrl.isNullOrEmpty() -> null // You could use a static audio icon if you prefer
            else -> null
        }

        if (thumbnailUrl != null) {
            Glide.with(holder.itemView.context)
                .load(thumbnailUrl)
                .placeholder(R.drawable.placeholder)
                .centerCrop()
                .into(holder.postImage)
        } else {
            // No media: show placeholder or audio icon
            holder.postImage.setImageResource(
                if (!post.audioUrl.isNullOrEmpty()) R.drawable.ic_audio_placeholder
                else R.drawable.placeholder
            )
        }
    }

    override fun getItemCount(): Int = posts.size
}
