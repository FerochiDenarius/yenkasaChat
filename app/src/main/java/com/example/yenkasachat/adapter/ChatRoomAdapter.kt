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
// Ensure these imports point to your UPDATED data models
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.Participant

class ChatRoomAdapter(
    // MODIFIED: Added currentUserId back as a parameter
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

        // The backend now structures the 'participants' list in the ChatRoom object
        // to contain the other participant's details directly for 1-on-1 chats.
        val otherParticipant: Participant? = if (chatRoom.isGroupChat == false) {
            // For 1-on-1 chats, the backend might send *only* the other participant in the list.
            // Or it might send both, and you'd filter out the currentUserId.
            // Assuming the backend sends only the *other* participant for 1-on-1 in chatRoom.participants.
            // If it sends both, you would need to add:
            // chatRoom.participants?.firstOrNull { it._id != currentUserId } // Assuming Participant has _id
            chatRoom.participants?.firstOrNull()
        } else {
            null // No single "other" participant for group chats in this context
        }

        // --- Set Contact Name ---
        holder.contactName.text = if (chatRoom.isGroupChat == true) {
            chatRoom.name ?: "Group Chat" // Use room name from backend for groups
        } else {
            otherParticipant?.username ?: "Unknown User" // Use other participant's name for 1-on-1
        }

        // --- Set Profile Image ---
        val profileUrlToLoad: String? = if (chatRoom.isGroupChat == true) {
            // chatRoom.groupImageUrl ?: "" // If you add a group image URL to your ChatRoom model
            null // For now, let placeholder/error handle groups, or define groupImageUrl
        } else {
            otherParticipant?.profileImage
        }

        Glide.with(holder.itemView.context)
            .load(profileUrlToLoad?.takeIf { it.isNotBlank() }) // Pass null to Glide if URL is blank
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(
                if (chatRoom.isGroupChat == true) R.drawable.ic_group_placeholder
                else R.drawable.ic_profile_placeholder
            )
            .circleCrop()
            .into(holder.profileImage)

        // --- Set Online Status Indicator ---
        if (chatRoom.isGroupChat == false && otherParticipant != null) {
            holder.onlineStatusIndicator.visibility = View.VISIBLE
            if (otherParticipant.isOnline == true) {
                holder.onlineStatusIndicator.setBackgroundResource(R.drawable.shape_oval_online)
            } else {
                holder.onlineStatusIndicator.setBackgroundResource(R.drawable.shape_oval_offline)
                // You could choose to hide the offline dot if preferred:
                // holder.onlineStatusIndicator.visibility = View.GONE
            }
        } else {
            // Hide for group chats or if no specific other participant
            holder.onlineStatusIndicator.visibility = View.GONE
        }

        // --- Set Last Message Preview ---
        val lastChatMessage = chatRoom.lastMessage
        val previewText = when {
            lastChatMessage == null -> "No messages yet"
            // Example: Prefix with sender if you have senderUsername in ChatMessage and currentUserId
            // val senderPrefix = if (lastChatMessage.senderId == currentUserId) "You: "
            //                     else if (lastChatMessage.senderUsername != null) "${lastChatMessage.senderUsername}: "
            //                     else ""
            lastChatMessage.imageUrl != null -> "📷 Photo" // Consider senderPrefix + "📷 Photo"
            lastChatMessage.audioUrl != null -> "🎤 Audio"
            lastChatMessage.videoUrl != null -> "🎬 Video"
            lastChatMessage.fileUrl != null -> "📄 File"
            lastChatMessage.location != null -> "📍 Location"
            lastChatMessage.contactInfo != null -> "👤 Contact"
            else -> lastChatMessage.text?.takeIf { it.isNotBlank() } ?: "..."
        }
        holder.lastMessage.text = previewText

        // --- Set Timestamp ---
        holder.timestamp.text = chatRoom.lastMessageTimeFormatted // Relies on getter in ChatRoom model

        // --- Set Unread Badge ---
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
        val onlineStatusIndicator: View = itemView.findViewById(R.id.viewOnlineStatus)
    }

    class DiffCallback : DiffUtil.ItemCallback<ChatRoom>() {
        override fun areItemsTheSame(oldItem: ChatRoom, newItem: ChatRoom): Boolean {
            // MODIFIED: Use the actual property name for the ID from your ChatRoom data class
            // Assuming it's 'id'. If it's different (e.g., 'roomId'), change it accordingly.
            return oldItem._id == newItem._id
        }

        override fun areContentsTheSame(oldItem: ChatRoom, newItem: ChatRoom): Boolean {
            // This is generally fine if ChatRoom is a data class and you want to compare all fields
            // for content changes. If ChatRoom becomes complex, you might need a more specific comparison.
            return oldItem == newItem
        }
    }
}
