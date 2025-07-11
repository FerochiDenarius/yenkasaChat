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
    val lastMessageTimestamp: String? = null, // ✅ changed from Long to String

    @SerializedName("unreadCount")
    val unreadCount: Int = 0
) {
    val lastMessageTimeFormatted: String
        get() = lastMessageTimestamp?.let {
            try {
                val isoFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                isoFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = isoFormat.parse(it)
                val outputFormat = SimpleDateFormat("hh:mm a", Locale.getDefault())
                outputFormat.format(date ?: return "")
            } catch (e: Exception) {
                ""
            }
        } ?: ""
}
