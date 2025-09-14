package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

// This data class now handles both the "lastMessage" preview (with potentially flat senderUsername)
// AND individual messages from the message list (with a nested sender object).
data class ChatMessage(
    @SerializedName("_id")
    val messageId: String? = null,

    var roomId: String? = null,

    // NEW: This will map to the populated "senderId" OBJECT from GET /api/messages/:roomId
    // The JSON key is "senderId", but it contains an object matching SenderData.
    @SerializedName("senderId")
    val sender: SenderData? = null,


    @SerializedName("senderUsername")
    val flatSenderUsername: String? = null, // Renamed for clarity

    @SerializedName("text")
    val text: String? = null,

    @SerializedName("imageUrl")
    val imageUrl: String? = null,

    @SerializedName("audioUrl")
    val audioUrl: String? = null,

    @SerializedName("videoUrl")
    val videoUrl: String? = null,

    @SerializedName("fileUrl")
    val fileUrl: String? = null,

    @SerializedName("contactInfo")
    val contactInfo: String? = null,

    @SerializedName("location")
    val location: LocationData? = null,

    // Ensure this matches the field name from your backend for message creation time.
    // Your latest messages.routes.js sorts by 'createdAt', so this should be 'createdAt'.
    @SerializedName("createdAt")
    val timestamp: String? = null // Maps to 'createdAt' from message JSON
) {
    // Convenience property to get the sender's user ID.
    // Prefers the ID from the nested 'sender' object.
    val actualSenderId: String?
        get() = sender?.id

    val actualSenderUsername: String?
        get() = sender?.username ?: flatSenderUsername

    // Convenience property to get the sender's profile image URL.
    val actualSenderProfileImageUrl: String?
        get() = sender?.profileImage
}

// LocationData remains the same
data class LocationData(
    @SerializedName("latitude")
    val latitude: Double,
    @SerializedName("longitude")
    val longitude: Double
)
