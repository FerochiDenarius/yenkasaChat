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
    private val lastMessageTime: String? = null,

    @SerializedName("name") // <- Name of the chat room
    val name: String? = null,

    @SerializedName("unreadCount")
    val unreadCount: Int = 0,

    @SerializedName("createdAt")
    private val createdAt: String? = null
) {

    // Formatted getter for lastMessageTime
    val lastMessageTimeFormatted: String
        get() = formatDate(lastMessageTime)

    // Formatted getter for createdAt
    val createdAtFormatted: String
        get() = formatDate(createdAt)

    // Robust date formatting
    private fun formatDate(dateString: String?): String {
        if (dateString.isNullOrEmpty()) return "N/A"
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date: Date = parser.parse(dateString) ?: return "Invalid Date"

            val formatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault()
            formatter.format(date)
        } catch (e: Exception) {
            Log.e("ChatRoomModel", "Error parsing date: $dateString", e)
            dateString
        }
    }
}
