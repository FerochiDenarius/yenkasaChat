package com.example.yenkasachat.model

data class ChatRoomResponse(
    val roomId: String,
    val participant: Participant,
    val lastMessage: LastMessage?,
    val lastMessageType: String?,
    val lastMessageAt: String?
)

data class Participant(
    val id: String,
    val username: String,
    val avatar: String?
)

data class LastMessage(
    val text: String?,
    val imageUrl: String?,
    val audioUrl: String?,
    val videoUrl: String?,
    val fileUrl: String?,
    val contactInfo: String?,
    val location: String?,
    val createdAt: String
)
