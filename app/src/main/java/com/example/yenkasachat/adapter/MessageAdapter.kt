package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.ChatMessage
import java.text.SimpleDateFormat
import java.util.*

class MessageAdapter(private val senderId: String) :
    ListAdapter<ChatMessage, RecyclerView.ViewHolder>(DiffCallback()) {

    companion object {
        private const val TYPE_SENT = 1
        private const val TYPE_RECEIVED = 2
    }

    override fun getItemViewType(position: Int): Int {
        return if (getItem(position).senderId == senderId) TYPE_SENT else TYPE_RECEIVED
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val layout = if (viewType == TYPE_SENT)
            R.layout.item_message_sent
        else
            R.layout.item_message_received

        val view = LayoutInflater.from(parent.context).inflate(layout, parent, false)
        return MessageViewHolder(view)
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        (holder as MessageViewHolder).bind(getItem(position))
    }

    class MessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val messageText: TextView = itemView.findViewById(R.id.textMessage)
        private val timestampText: TextView = itemView.findViewById(R.id.textTimestamp)
        private val messageImage: ImageView = itemView.findViewById(R.id.imageMessage)

        fun bind(message: ChatMessage) {
            val hasText = !message.text.isNullOrBlank()
            val hasImage = !message.imageUrl.isNullOrBlank()

            // Show/hide text
            if (hasText) {
                messageText.visibility = View.VISIBLE
                messageText.text = message.text
            } else {
                messageText.visibility = View.GONE
            }

            // Show/hide image
            if (hasImage) {
                messageImage.visibility = View.VISIBLE
                Glide.with(itemView.context)
                    .load(message.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.error_image)
                    .into(messageImage)
            } else {
                messageImage.visibility = View.GONE
            }

            // Timestamp
            timestampText.text = formatTimestamp(message.timestamp)
        }

        private fun formatTimestamp(rawTimestamp: String?): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(rawTimestamp ?: "")
                val outputFormat = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
                outputFormat.format(date ?: Date())
            } catch (e: Exception) {
                rawTimestamp ?: ""
            }
        }
    }

    class DiffCallback : DiffUtil.ItemCallback<ChatMessage>() {
        override fun areItemsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem.messageId == newItem.messageId
        }

        override fun areContentsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem == newItem
        }
    }
}
