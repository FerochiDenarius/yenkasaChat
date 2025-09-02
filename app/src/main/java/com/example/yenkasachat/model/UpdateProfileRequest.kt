package com.example.yenkasachat.model

data class UpdateProfileRequest(
    val username: String? = null,
    val phone: String? = null,
    val location: String? = null
    // ... any other fields
)