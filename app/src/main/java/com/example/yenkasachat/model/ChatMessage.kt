// In model/ChatMessage.kt
package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

// This data class can serve for both the "lastMessage" preview
// and for individual messages in a chat screen.
data class ChatMessage(
    @SerializedName("_id")
    val messageId: String? = null, // Backend sends this as "_id" for the lastMessage

    // roomId will be null when this ChatMessage is part of the ChatRoom's lastMessage object
    // from GET /api/chatrooms. It will be populated in other contexts.
    var roomId: String? = null, // Make it 'var' if you might populate it later in the adapter/VM

    @SerializedName("senderId")
    val senderId: String? = null,

    @SerializedName("senderUsername") // Backend now sends this for lastMessage
    val senderUsername: String? = null,

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
    val contactInfo: String? = null, // Ensure backend sends this if you need it for lastMessage

    @SerializedName("location")
    val location: LocationData? = null, // Ensure backend sends this for lastMessage

    // Backend sends "createdAt" for the lastMessage object.
    // Alias it to your existing "timestamp" field or use "createdAt" directly.
    // Using "createdAt" to match backend for clarity here.
    @SerializedName("createdAt")
    val timestamp: String? = null // This will map to 'createdAt' from the lastMessage JSON
)

data class LocationData(
    @SerializedName("latitude")
    val latitude: Double,
    @SerializedName("longitude")
    val longitude: Double
)
