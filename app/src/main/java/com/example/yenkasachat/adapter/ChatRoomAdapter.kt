package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.User


class ChatRoomAdapter(
    private val chatRooms: List<ChatRoom>,
    private val currentUserId: String,
    private val onChatRoomClick: (ChatRoom) -> Unit
) : RecyclerView.Adapter<ChatRoomAdapter.ChatRoomViewHolder>() {


    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ChatRoomViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_chat_room, parent, false)
        return ChatRoomViewHolder(view)
    }

    override fun onBindViewHolder(holder: ChatRoomViewHolder, position: Int) {
        val chatRoom = chatRooms[position]

        val contactUser = chatRoom.participants.firstOrNull {
            it._id != currentUserId
        }


        holder.contactName.text = contactUser?.username ?: "Unknown"

        Glide.with(holder.itemView.context)
            .load(contactUser?.profileImage)
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .into(holder.profileImage)

        holder.lastMessage.text = chatRoom.lastMessage ?: "No messages yet"

        holder.itemView.setOnClickListener {
            onChatRoomClick(chatRoom)
        }
    }

    override fun getItemCount(): Int = chatRooms.size

    class ChatRoomViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val contactName: TextView = itemView.findViewById(R.id.textContactName)
        val lastMessage: TextView = itemView.findViewById(R.id.textLastMessage)
        val profileImage: ImageView = itemView.findViewById(R.id.imageProfile)
    }
}
