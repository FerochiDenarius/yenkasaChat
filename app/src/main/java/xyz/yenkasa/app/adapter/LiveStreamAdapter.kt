package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LiveStream

class LiveStreamAdapter(
    private val onClick: (LiveStream) -> Unit
) : ListAdapter<LiveStream, LiveStreamAdapter.LiveStreamViewHolder>(Diff) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LiveStreamViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_live_stream, parent, false)
        return LiveStreamViewHolder(view, onClick)
    }

    override fun onBindViewHolder(holder: LiveStreamViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class LiveStreamViewHolder(
        itemView: View,
        private val onClick: (LiveStream) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {
        private val thumbnail: ImageView = itemView.findViewById(R.id.imageLiveThumbnail)
        private val title: TextView = itemView.findViewById(R.id.textLiveStreamTitle)
        private val host: TextView = itemView.findViewById(R.id.textLiveStreamHost)
        private val meta: TextView = itemView.findViewById(R.id.textLiveStreamMeta)

        fun bind(stream: LiveStream) {
            title.text = stream.title
            host.text = itemView.context.getString(R.string.live_host_handle, stream.hostUsername)
            meta.text = if (stream.community.isNotBlank()) {
                itemView.context.getString(R.string.live_stream_meta_with_community, stream.viewerCount, stream.community)
            } else {
                itemView.context.getString(R.string.live_stream_meta, stream.viewerCount)
            }

            val image = stream.thumbnail.ifBlank { stream.hostAvatar }
            Glide.with(itemView)
                .load(image)
                .placeholder(R.drawable.ic_profile_placeholder)
                .centerCrop()
                .into(thumbnail)

            itemView.setOnClickListener { onClick(stream) }
        }
    }

    private object Diff : DiffUtil.ItemCallback<LiveStream>() {
        override fun areItemsTheSame(oldItem: LiveStream, newItem: LiveStream): Boolean {
            return oldItem.id == newItem.id
        }

        override fun areContentsTheSame(oldItem: LiveStream, newItem: LiveStream): Boolean {
            return oldItem == newItem
        }
    }
}
