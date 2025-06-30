package com.example.yenkasachat.model

data class ChatMessage(
    val messageId: String,
    val roomId: String,
    val senderId: String,
    val text: String,
    val timestamp: String,
    val status: String = "sent"
)
