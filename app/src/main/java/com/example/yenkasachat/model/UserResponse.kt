package com.example.yenkasachat.model

data class UserResponse(
    val success: Boolean,
    val message: String?,
    val user: User?
)
