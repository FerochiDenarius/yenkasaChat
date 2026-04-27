package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R

class EmojiPickerAdapter(
    private val emojis: List<String>,
    private val onEmojiClicked: (String) -> Unit
) : RecyclerView.Adapter<EmojiPickerAdapter.EmojiViewHolder>() {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EmojiViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_emoji_picker, parent, false)
        return EmojiViewHolder(view)
    }

    override fun onBindViewHolder(holder: EmojiViewHolder, position: Int) {
        holder.bind(emojis[position])
    }

    override fun getItemCount(): Int = emojis.size

    inner class EmojiViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val emojiText: TextView = itemView.findViewById(R.id.textEmoji)

        fun bind(emoji: String) {
            emojiText.text = emoji
            itemView.setOnClickListener { onEmojiClicked(emoji) }
        }
    }
}
