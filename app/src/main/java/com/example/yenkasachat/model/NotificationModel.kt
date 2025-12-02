package com.example.yenkasachat.model

data class NotificationModel(
    val id: String,
    val type: String,
    val senderId: String,
    val receiverId: String,
    val message: String?,
    val postId: String?,
    val status: String, // "unread" or "read"
    val createdAt: String
)
data class NotificationSound(
    val id: String,
    val title: String,
    val rawResId: Int
)
