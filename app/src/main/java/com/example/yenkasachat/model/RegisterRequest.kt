package com.example.yenkasachat.model

data class RegisterRequest(
    val email: String?,
    val phone: String?,
    val username: String,
    val location: String,
    val password: String,
    val communityId: String,
    val country: String = "Ghana"
)
