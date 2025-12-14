package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class ChatMessage(
    @SerializedName("_id")
    val id: String? = null,

    val roomId: String? = null,

    // 🚨 senderId can be String or Object → change to Any?
    @SerializedName("senderId")
    val senderIdRaw: Any? = null,

    val text: String? = null,
    val imageUrl: String? = null,
    val audioUrl: String? = null,
    val videoUrl: String? = null,
    val fileUrl: String? = null,
    val contactInfo: String? = null,
    val location: LocationData? = null,

    val timestamp: String? = null,

    @SerializedName("status")
    val status: String? = null,

    @SerializedName("repliedTo")
    val repliedTo: ChatMessage? = null,

    @SerializedName("sender")
    val sender: Participant? = null
) {

    // 👉 SAFE EXTRACTED USER ID (use this everywhere instead of senderId)
    val senderId: String?
        get() = when (senderIdRaw) {
            is String -> senderIdRaw
            is Map<*, *> -> senderIdRaw["_id"] as? String
            else -> null
        }
}

data class LocationData(
    val latitude: Double,
    val longitude: Double
)
