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
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatRoom

class ChatRoomAdapter(
    private val currentUserId: String,
    private val onChatRoomClick: (ChatRoom) -> Unit,
    private val onChatRoomLongClick: ((ChatRoom) -> Unit)? = null
) : ListAdapter<ChatRoom, ChatRoomAdapter.ChatRoomViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatRoomViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_room, parent, false)
        return ChatRoomViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatRoomViewHolder, position: Int) {
        val chatRoom = getItem(position)
        val context = holder.itemView.context

        // --- Last message preview ---
        val message = chatRoom.lastMessage
        val previewText = when {
            message == null -> context.getString(R.string.no_messages_yet)
            !message.imageUrl.isNullOrBlank() -> context.getString(R.string.chat_preview_photo)
            !message.audioUrl.isNullOrBlank() -> context.getString(R.string.chat_preview_audio)
            !message.videoUrl.isNullOrBlank() -> context.getString(R.string.chat_preview_video)
            !message.fileUrl.isNullOrBlank() -> context.getString(R.string.chat_preview_file)
            message.location != null -> context.getString(R.string.chat_preview_location)
            !message.contactInfo.isNullOrBlank() -> context.getString(R.string.chat_preview_contact)
            !message.text.isNullOrBlank() -> message.text
            else -> context.getString(R.string.unsupported_message_type)
        }
        holder.lastMessage.text = previewText

        // --- Deduplicate and filter participants ---
        val uniqueParticipants = chatRoom.participants
            ?.distinctBy { it._id }
            ?.filterNot { it._id == currentUserId }

        // --- Determine display user or group ---
        val contactUser = uniqueParticipants?.firstOrNull()
        val displayName = when {
            chatRoom.roomType == "group" -> chatRoom.groupName ?: context.getString(R.string.group_default_name)
            uniqueParticipants == null -> context.getString(R.string.unknown_chat)
            uniqueParticipants.isEmpty() -> context.getString(R.string.chat_with_yourself)
            uniqueParticipants.size == 1 -> contactUser?.username ?: context.getString(R.string.unknown_user)
            else -> uniqueParticipants.take(2).joinToString(", ") { it.username ?: context.getString(R.string.user) } +
                    if (uniqueParticipants.size > 2) "..." else ""
        }

        holder.contactName.text = displayName

        // --- Profile image (first participant only for group) ---
        val profileUrl = if (chatRoom.roomType == "group") chatRoom.groupImage else contactUser?.displayImage
        Glide.with(context)
            .load(profileUrl)
            .apply(RequestOptions.circleCropTransform())
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .into(holder.profileImage)

        // --- Online/offline indicator ---
        if (chatRoom.roomType != "group" && contactUser != null && uniqueParticipants.size == 1) {
            holder.onlineIndicator.visibility = View.VISIBLE
            holder.onlineIndicator.setBackgroundResource(
                if (contactUser.resolvedOnline) R.drawable.bg_chat_online_dot else R.drawable.bg_chat_offline_dot
            )
        } else {
            holder.onlineIndicator.visibility = View.GONE
        }

        // --- Timestamp ---
        holder.timestamp.text = chatRoom.lastMessageTimeFormatted.takeIf { it != "N/A" } ?: ""

        // --- Unread badge ---
        if (chatRoom.unreadCount > 0) {
            holder.unreadBadge.visibility = View.VISIBLE
            holder.unreadBadge.text = chatRoom.unreadCount.toString()
        } else {
            holder.unreadBadge.visibility = View.GONE
        }

        // --- Click listener ---
        holder.itemView.setOnClickListener { onChatRoomClick(chatRoom) }
        holder.itemView.setOnLongClickListener {
            onChatRoomLongClick?.invoke(chatRoom)
            onChatRoomLongClick != null
        }
    }

    class ChatRoomViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val contactName: TextView = itemView.findViewById(R.id.textContactName)
        val lastMessage: TextView = itemView.findViewById(R.id.textLastMessage)
        val profileImage: ImageView = itemView.findViewById(R.id.imageProfile)
        val onlineIndicator: View = itemView.findViewById(R.id.viewOnlineIndicator)
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
