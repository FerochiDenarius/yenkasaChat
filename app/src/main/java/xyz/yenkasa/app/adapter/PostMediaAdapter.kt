// app/src/main/java/xyz.yenkasa.appchat/adapter/PostMediaAdapter.kt
package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R

class PostMediaAdapter(
    private val mediaUrls: List<String>
) : RecyclerView.Adapter<PostMediaAdapter.MediaViewHolder>() {

    inner class MediaViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val mediaImage: ImageView = itemView.findViewById(R.id.imageMediaItem)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MediaViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_post_media, parent, false)
        return MediaViewHolder(view)
    }

    override fun onBindViewHolder(holder: MediaViewHolder, position: Int) {
        Glide.with(holder.itemView.context)
            .load(mediaUrls[position])
            .placeholder(R.drawable.placeholder_image)
            .into(holder.mediaImage)
    }

    override fun getItemCount(): Int = mediaUrls.size
}
