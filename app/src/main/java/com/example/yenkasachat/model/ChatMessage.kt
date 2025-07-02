package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class ChatMessage(
    @SerializedName("_id")
    val messageId: String? = null,

    val roomId: String? = null,
    val senderId: String? = null,
    val text: String? = null,
    val imageUrl: String? = null,
    val audioUrl: String? = null,
    val timestamp: String? = null,
    val location: LocationData? = null
)

data class LocationData(
    val latitude: Double,
    val longitude: Double
)
