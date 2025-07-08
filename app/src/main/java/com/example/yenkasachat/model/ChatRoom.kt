package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.*

data class ChatRoom(
    @SerializedName("_id")
    val _id: String,  // MongoDB ID

    val participants: List<User>,

    val lastMessage: String? = null,

    @SerializedName("lastMessageTimestamp")
    val lastMessageTimestamp: Long? = null, // in millis or seconds from backend

    @SerializedName("unreadCount")
    val unreadCount: Int = 0
) {
    val lastMessageTimeFormatted: String
        get() = lastMessageTimestamp?.let {
            val timeMillis = if (it < 1000000000000L) it * 1000 else it // detect if in seconds
            val sdf = SimpleDateFormat("hh:mm a", Locale.getDefault())
            sdf.format(Date(timeMillis))
        } ?: ""
}
