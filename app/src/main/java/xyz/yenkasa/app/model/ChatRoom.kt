package xyz.yenkasa.app.model

import android.util.Log
import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.Date

data class ChatRoom(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("participants")
    val participants: List<Participant>?,

    @SerializedName("lastMessage")
    val lastMessage: ChatMessage?,

    @SerializedName("lastMessageTime")
    val lastMessageTime: String? = null,

    @SerializedName("name") // <- Name of the chat room
    val name: String? = null,

    @SerializedName("unreadCount")
    val unreadCount: Int = 0,

    @SerializedName("createdAt")
    val createdAt: String? = null
) {

    // Formatted getter for lastMessageTime
    val lastMessageTimeFormatted: String
        get() = formatDate(lastMessageTime)

    // Formatted getter for createdAt
    val createdAtFormatted: String
        get() = formatDate(createdAt)

    val lastActivityTimeMillis: Long
        get() = parseDate(lastMessageTime ?: lastMessage?.timestamp ?: createdAt)?.time ?: 0L

    // Robust date formatting
    private fun formatDate(dateString: String?): String {
        val date = parseDate(dateString) ?: return if (dateString.isNullOrEmpty()) "N/A" else dateString
        val formatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
        formatter.timeZone = TimeZone.getDefault()
        return formatter.format(date)
    }

    private fun parseDate(dateString: String?): Date? {
        if (dateString.isNullOrEmpty()) return null
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC")
            parser.parse(dateString)
        } catch (e: Exception) {
            try {
                val fallbackParser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
                fallbackParser.timeZone = TimeZone.getTimeZone("UTC")
                fallbackParser.parse(dateString)
            } catch (fallback: Exception) {
                Log.e("ChatRoomModel", "Error parsing date: $dateString", fallback)
                null
            }
        }
    }
}
