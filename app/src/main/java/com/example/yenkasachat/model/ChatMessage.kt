package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class ChatMessage(
    @SerializedName("_id")
    val id: String? = null,

    val roomId: String? = null,

    val senderId: String? = null, // ✅ Keep senderId as String

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
    val sender: Participant? = null // ✅ Keep sender object separate
)

data class LocationData(
    val latitude: Double,
    val longitude: Double
)
