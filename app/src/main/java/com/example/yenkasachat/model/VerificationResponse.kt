package com.example.yenkasachat.model // Updated package

data class VerificationResponse(
    val message: String,
    val expiresAt: String? = null,
    val verified: Boolean? = null,
    val emailVerified: Boolean? = null
)