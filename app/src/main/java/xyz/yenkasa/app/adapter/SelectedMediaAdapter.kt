package xyz.yenkasa.app.adapter

import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMediaItem

class SelectedMediaAdapter(
    private val onSelectedClicked: (Int) -> Unit,
    private val onRemoveClicked: (ChatMediaItem) -> Unit
) : RecyclerView.Adapter<SelectedMediaAdapter.SelectedMediaViewHolder>() {

    private val items = mutableListOf<ChatMediaItem>()
    private var activeIndex: Int = 0

    fun submitList(newItems: List<ChatMediaItem>, selectedIndex: Int = activeIndex) {
        items.clear()
        items.addAll(newItems)
        activeIndex = selectedIndex.coerceIn(0, (items.size - 1).coerceAtLeast(0))
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): SelectedMediaViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_selected_media, parent, false)
        return SelectedMediaViewHolder(view)
    }

    override fun onBindViewHolder(holder: SelectedMediaViewHolder, position: Int) {
        holder.bind(items[position], position == activeIndex)
    }

    override fun getItemCount(): Int = items.size

    inner class SelectedMediaViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val imageView: ImageView = itemView.findViewById(R.id.imageSelectedThumb)
        private val removeButton: ImageButton = itemView.findViewById(R.id.buttonRemoveSelected)
        private val numberBadge: TextView = itemView.findViewById(R.id.textSelectedNumber)

        fun bind(item: ChatMediaItem, isActive: Boolean) {
            Glide.with(imageView)
                .load(Uri.parse(item.uriString))
                .centerCrop()
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.error_image)
                .into(imageView)

            numberBadge.text = (bindingAdapterPosition + 1).toString()
            itemView.isSelected = isActive
            itemView.setOnClickListener { onSelectedClicked(bindingAdapterPosition) }
            removeButton.setOnClickListener { onRemoveClicked(item) }
        }
    }
}
