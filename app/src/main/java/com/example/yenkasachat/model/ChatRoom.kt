// In your ChatRoom.kt file
package com.example.yenkasachat.model

import android.util.Log
import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class ChatRoom(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("name") // New: Name of the chat room (other user's name or group name)
    val name: String?,

    @SerializedName("participants")
    val participants: List<Participant>?, // Uses the new Participant data class

    @SerializedName("isGroupChat") // New: Boolean to indicate if it's a group chat
    val isGroupChat: Boolean? = false, // Default to false

    @SerializedName("lastMessage")
    val lastMessage: ChatMessage?, // Uses the updated ChatMessage data class

    @SerializedName("lastMessageTime") // This is the raw ISO string from backend
    private val lastMessageTimeRaw: String?, // Renamed to avoid clash with getter, stores raw date

    @SerializedName("unreadCount")
    val unreadCount: Int = 0,

    @SerializedName("createdAt") // Raw ISO string from backend
    private val createdAtRaw: String?, // Renamed to avoid clash with getter

    @SerializedName("updatedAt") // New: Raw ISO string from backend
    private val updatedAtRaw: String? // Renamed to avoid clash with getter

    // You can add other fields like 'groupImageUrl' if your backend sends it for group chats
    // @SerializedName("groupImageUrl")
    // val groupImageUrl: String?
) {

    // Formatted getter for the displayable last message time
    val lastMessageTimeFormatted: String
        get() {
            // Prefer lastMessage.createdAt if available, then lastMessageTimeRaw (which might be room's updatedAt)
            val effectiveTime = lastMessage?.timestamp ?: lastMessageTimeRaw
            return formatDate(effectiveTime, "hh:mm a") // Example short format
        }

    // Formatted getter for the room's creation date (if needed for display)
    val createdAtFormatted: String
        get() {
            return formatDate(createdAtRaw, "MMM dd, yyyy") // Example format
        }

    // Formatted getter for the room's last update time (if needed for display)
    val updatedAtFormatted: String
        get() {
            return formatDate(updatedAtRaw, "MMM dd, yyyy hh:mm a") // Example format
        }

    // Common date formatting utility function
    private fun formatDate(dateString: String?, outputPattern: String): String {
        if (dateString.isNullOrEmpty()) {
            return "" // Return empty or a placeholder like "N/A"
        }
        return try {
            // Input format from backend (ISO 8601)
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC") // Assuming backend sends UTC
            val date: Date = parser.parse(dateString) ?: return dateString // Fallback to raw if parse returns null

            // Desired output format
            val formatter = SimpleDateFormat(outputPattern, Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault() // Display in user's local time
            formatter.format(date)
        } catch (e: Exception) {
            Log.e("ChatRoomModel", "Error parsing date: $dateString for pattern $outputPattern", e)
            // Fallback: Try to return just the date part or the raw string if parsing fails badly
            try {
                dateString.substringBefore("T")
            } catch (subError: Exception) {
                dateString // Ultimate fallback
            }
        }
    }
}
