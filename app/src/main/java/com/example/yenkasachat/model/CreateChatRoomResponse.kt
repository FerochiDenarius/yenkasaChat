package com.example.yenkasachat.model

data class CreateChatRoomResponse(
    val success: Boolean = false,
    val roomId: String? = null,
    val message: String? = null
)
