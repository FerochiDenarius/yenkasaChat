package com.example.yenkasachat.model

data class RegisterRequest(
    val email: String?,
    val phone: String?,
    val username: String,
    val password: String,
    val location: String
)