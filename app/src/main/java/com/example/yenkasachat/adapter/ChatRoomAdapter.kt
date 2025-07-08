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
import com.example.yenkasachat.model.ChatRoom

class ChatRoomAdapter(
    private val currentUserId: String,
    private val onChatRoomClick: (ChatRoom) -> Unit
) : ListAdapter<ChatRoom, ChatRoomAdapter.ChatRoomViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatRoomViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_room, parent, false)
        return ChatRoomViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatRoomViewHolder, position: Int) {
        val chatRoom = getItem(position)

        val contactUser = chatRoom.participants.firstOrNull {
            it._id != currentUserId
        }

        holder.contactName.text = contactUser?.username ?: "Unknown"

        val profileUrl = contactUser?.profileImage ?: ""
        Glide.with(holder.itemView.context)
            .load(profileUrl)
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .into(holder.profileImage)

        holder.lastMessage.text = chatRoom.lastMessage ?: "No messages yet"

        // Optional: Display timestamp if available
        holder.timestamp.text = chatRoom.lastMessageTimeFormatted ?: ""

        // Optional: Show unread badge
        if (chatRoom.unreadCount > 0) {
            holder.unreadBadge.visibility = View.VISIBLE
            holder.unreadBadge.text = chatRoom.unreadCount.toString()
        } else {
            holder.unreadBadge.visibility = View.GONE
        }

        holder.itemView.setOnClickListener {
            onChatRoomClick(chatRoom)
        }
    }

    class ChatRoomViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val contactName: TextView = itemView.findViewById(R.id.textContactName)
        val lastMessage: TextView = itemView.findViewById(R.id.textLastMessage)
        val profileImage: ImageView = itemView.findViewById(R.id.imageProfile)
        val timestamp: TextView = itemView.findViewById(R.id.textTimestamp)
        val unreadBadge: TextView = itemView.findViewById(R.id.textUnreadBadge)
    }

    class DiffCallback : DiffUtil.ItemCallback<ChatRoom>() {
        override fun areItemsTheSame(oldItem: ChatRoom, newItem: ChatRoom): Boolean {
            return oldItem._id == newItem._id
        }

        override fun areContentsTheSame(oldItem: ChatRoom, newItem: ChatRoom): Boolean {
            return oldItem == newItem
        }
    }
}
