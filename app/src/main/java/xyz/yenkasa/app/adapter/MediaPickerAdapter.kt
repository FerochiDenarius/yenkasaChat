package xyz.yenkasa.app.adapter

import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMediaItem

class MediaPickerAdapter(
    private val onMediaClicked: (ChatMediaItem) -> Unit
) : RecyclerView.Adapter<MediaPickerAdapter.MediaViewHolder>() {

    private val items = mutableListOf<ChatMediaItem>()
    private val selectedOrderByUri = linkedMapOf<String, Int>()

    fun submitList(newItems: List<ChatMediaItem>) {
        items.clear()
        items.addAll(newItems)
        notifyDataSetChanged()
    }

    fun updateSelection(selectedItems: List<ChatMediaItem>) {
        selectedOrderByUri.clear()
        selectedItems.forEachIndexed { index, item ->
            selectedOrderByUri[item.uriString] = index + 1
        }
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): MediaViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_media_picker, parent, false)
        return MediaViewHolder(view)
    }

    override fun onBindViewHolder(holder: MediaViewHolder, position: Int) {
        holder.bind(items[position], selectedOrderByUri[items[position].uriString])
    }

    override fun getItemCount(): Int = items.size

    inner class MediaViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val thumbnail: ImageView = itemView.findViewById(R.id.imageMediaThumb)
        private val overlay: View = itemView.findViewById(R.id.viewMediaOverlay)
        private val selectionBadge: TextView = itemView.findViewById(R.id.textSelectionBadge)
        private val playBadge: ImageView = itemView.findViewById(R.id.imagePlayBadge)
        private val typeLabel: TextView = itemView.findViewById(R.id.textMediaType)

        fun bind(item: ChatMediaItem, selectedOrder: Int?) {
            val context = itemView.context
            itemView.isSelected = selectedOrder != null
            overlay.visibility = if (selectedOrder != null) View.VISIBLE else View.GONE
            selectionBadge.visibility = if (selectedOrder != null) View.VISIBLE else View.GONE
            selectionBadge.text = selectedOrder?.toString().orEmpty()
            playBadge.visibility = if (item.isVideo && !item.isCameraShortcut) View.VISIBLE else View.GONE

            if (item.isCameraShortcut) {
                thumbnail.setImageResource(R.drawable.ic_camera)
                thumbnail.setPadding(36, 36, 36, 36)
                thumbnail.setColorFilter(ContextCompat.getColor(context, R.color.chat_picker_icon))
                typeLabel.visibility = View.VISIBLE
                typeLabel.text = context.getString(R.string.chat_media_camera)
            } else {
                thumbnail.clearColorFilter()
                thumbnail.setPadding(0, 0, 0, 0)
                Glide.with(thumbnail)
                    .load(Uri.parse(item.uriString))
                    .centerCrop()
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.error_image)
                    .into(thumbnail)

                typeLabel.visibility = View.VISIBLE
                typeLabel.text = if (item.isVideo) {
                    context.getString(R.string.chat_media_video)
                } else {
                    context.getString(R.string.chat_media_photo)
                }
            }

            itemView.setOnClickListener { onMediaClicked(item) }
        }
    }
}
