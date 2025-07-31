// In your ChatRoom.kt file
package com.example.yenkasachat.model

import android.util.Log
import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.Date // Make sure to import Date

data class ChatRoom(
    @SerializedName("_id")
    val _id: String,
    @SerializedName("participants")
    val participants: List<Participant>?, // Assuming Participant model exists
    @SerializedName("lastMessage")
    val lastMessage: String?, // Or your Message object type
    @SerializedName("lastMessageTime")
    private val lastMessageTime: String?, // Or Date, ensure this is handled
    @SerializedName("unreadCount")
    val unreadCount: Int = 0, // Assuming this field exists

    // Add this field to receive the raw createdAt string from the backend
    @SerializedName("createdAt") // Or whatever name your backend sends (e.g., "creationDate")
    private val createdAt: String? = null // Store as String, make it private if only used for formatting
) {

    // Formatted getter for lastMessageTime (similar to what you might have had)
    val lastMessageTimeFormatted: String
        get() {
            return formatDate(lastMessageTime)
        }

    // Add this formatted getter for createdAt
    val createdAtFormatted: String
        get() {
            return formatDate(createdAt) // Use the same formatDate utility
        }

    // Your existing formatDate function or a new one
    // (Make sure this function is robust and handles null or malformed dates)
    private fun formatDate(dateString: String?): String {
        if (dateString.isNullOrEmpty()) {
            return "N/A" // Or an empty string, or some default
        }
        return try {
            // Input format from backend (e.g., ISO 8601)
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC") // Assuming backend sends UTC
            val date: Date = parser.parse(dateString) ?: return "Invalid Date"

            // Desired output format
            val formatter = SimpleDateFormat("MMM dd, yyyy hh:mm a", Locale.getDefault())
            formatter.timeZone = TimeZone.getDefault() // Display in user's local time
            formatter.format(date)
        } catch (e: Exception) {
            Log.e("ChatRoomModel", "Error parsing date: $dateString", e)
            dateString // Fallback to raw string if parsing fails
        }
    }
}
