package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.CloudinaryMedia

class ProfilePostAdapter(
    private val posts: MutableList<Post> = mutableListOf(),
    private val onPostClick: (Post) -> Unit
) :
    RecyclerView.Adapter<ProfilePostAdapter.PostViewHolder>() {

    inner class PostViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val postImage: ImageView = itemView.findViewById(R.id.imagePostPreview)
        val postText: TextView = itemView.findViewById(R.id.textPostPreview)
        val typeIcon: ImageView = itemView.findViewById(R.id.iconPostPreviewType)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PostViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_preview, parent, false)
        return PostViewHolder(view)
    }

    override fun onBindViewHolder(holder: PostViewHolder, position: Int) {
        val post = posts[position]
        holder.itemView.post {
            val width = holder.itemView.width
            if (width > 0 && holder.itemView.layoutParams.height != width) {
                holder.itemView.layoutParams = holder.itemView.layoutParams.apply {
                    height = width
                }
            }
        }

        holder.itemView.setOnClickListener { onPostClick(post) }
        holder.postImage.visibility = View.VISIBLE
        holder.postText.visibility = View.GONE
        holder.typeIcon.visibility = View.GONE

        val thumbnailUrl = when {
            post.effectiveImageUrls().isNotEmpty() -> post.effectiveImageUrls().first()
            !post.videoUrl.isNullOrEmpty() -> post.optimizedVideoPosterUrl()
            else -> null
        }

        if (thumbnailUrl != null) {
            val request = Glide.with(holder.itemView.context)
                .load(thumbnailUrl)
                .placeholder(R.drawable.placeholder)
                .error(R.drawable.placeholder)
                .centerCrop()

            if (!post.videoUrl.isNullOrEmpty()) {
                request
                    .apply(RequestOptions().diskCacheStrategy(DiskCacheStrategy.ALL))
                    .into(holder.postImage)
                holder.typeIcon.visibility = View.VISIBLE
                holder.typeIcon.setImageResource(R.drawable.ic_play_arrow)
            } else {
                request.into(holder.postImage)
                if (post.effectiveImageUrls().size > 1) {
                    holder.typeIcon.visibility = View.VISIBLE
                    holder.typeIcon.setImageResource(R.drawable.ic_image)
                }
            }
        } else if (!post.audioUrl.isNullOrEmpty()) {
            holder.postImage.setImageResource(R.drawable.ic_audio_placeholder)
            holder.typeIcon.visibility = View.VISIBLE
            holder.typeIcon.setImageResource(R.drawable.ic_audio_wave)
        } else {
            holder.postImage.visibility = View.GONE
            holder.postText.visibility = View.VISIBLE
            holder.postText.text = post.caption?.takeIf { it.isNotBlank() } ?: "Post"
        }
    }

    fun submitPosts(newPosts: List<Post>) {
        posts.clear()
        posts.addAll(newPosts)
        notifyDataSetChanged()
    }

    override fun getItemCount(): Int = posts.size
}
