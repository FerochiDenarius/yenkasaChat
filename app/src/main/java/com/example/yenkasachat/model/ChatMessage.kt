package com.example.yenkasachat.model

data class ChatMessage(
    val messageId: String? = null,
    val roomId: String? = null,
    val senderId: String? = null,
    val text: String? = null,
    val imageUrl: String? = null, // ✅ Must exist
    val audioUrl: String? = null,
    val timestamp: String? = null,
    val location: LocationData? = null // optional if location support is in
)

data class LocationData(
    val latitude: Double,
    val longitude: Double
)
