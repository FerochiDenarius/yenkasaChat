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
// import com.example.yenkasachat.model.Participant // Not strictly needed if ChatRoom uses it correctly

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

        val previewText = when {
            chatRoom.lastMessage?.contains("[Image]", ignoreCase = true) == true -> "📷 Photo"
            chatRoom.lastMessage?.contains("[Audio]", ignoreCase = true) == true -> "🎤 Audio"
            chatRoom.lastMessage?.contains("[Video]", ignoreCase = true) == true -> "🎬 Video"
            chatRoom.lastMessage?.contains("[File]", ignoreCase = true) == true -> "📄 File"
            chatRoom.lastMessage?.contains("[Location]", ignoreCase = true) == true -> "📍 Location"
            chatRoom.lastMessage?.contains("[Contact]", ignoreCase = true) == true -> "👤 Contact"
            chatRoom.lastMessage?.isNotBlank() == true -> chatRoom.lastMessage
            else -> "No messages yet"
        }
        holder.lastMessage.text = previewText

        // ******** CORRECTED SECTION ********
        // Use safe call (?.) on chatRoom.participants as it can be null
        val contactUser = chatRoom.participants?.firstOrNull { participant ->
            participant._id != currentUserId // Assuming Participant has an _id field
        }

        // Determine contact name. If it's a group or participants list is null/empty,
        // you might want a different logic, e.g., show "Group Chat" or use chatRoom.name if it exists.
        // For now, it defaults to "Unknown" if no specific contactUser is found or participants is null.
        holder.contactName.text = contactUser?.username ?: determineChatName(chatRoom)

        val profileUrl = contactUser?.profileImage ?: "" // Defaults to empty if no specific contact or no image
        Glide.with(holder.itemView.context)
            .load(profileUrl)
            .placeholder(R.drawable.ic_profile_placeholder) // Ensure this drawable exists
            .error(R.drawable.ic_profile_placeholder)       // Ensure this drawable exists
            .into(holder.profileImage)
        // ******** END OF CORRECTED SECTION ********

        // ✅ Timestamp now correctly parsed from ISO8601 (Assuming this getter exists and is correct)
        holder.timestamp.text = chatRoom.lastMessageTimeFormatted

        // ✅ Show unread count
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

    /**
     * Helper function to determine a display name for the chat.
     * This can be expanded based on your app's logic for group chats vs. 1-on-1.
     */
    private fun determineChatName(chatRoom: ChatRoom): String {
        // If there's a specific chatRoom.name field from your backend, you could use it here for groups.
        // e.g., if (chatRoom.name.isNotBlank()) return chatRoom.name

        val otherParticipants = chatRoom.participants?.filter { it._id != currentUserId }

        return when {
            otherParticipants == null -> "Unknown Chat" // Participants list was null
            otherParticipants.isEmpty() -> "Chat with yourself" // Only current user or no other users found
            otherParticipants.size == 1 -> otherParticipants.first().username ?: "Unknown User" // 1-on-1
            else -> {
                // Group chat: list first few names or a generic "Group Chat"
                otherParticipants.take(2).joinToString(", ") { it.username ?: "User" } +
                        if (otherParticipants.size > 2) "..." else ""
            }
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
            // Consider if participants list changes should trigger content change.
            // Default '==' for data class will check all properties including the participants list.
            return oldItem == newItem
        }
    }
}
