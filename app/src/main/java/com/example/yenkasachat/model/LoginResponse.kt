package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    val user: AuthUser,
    val token: String
)

data class AuthUser(
    @SerializedName("_id")
    val _id: String, // ✅ Correct mapping for MongoDB _id
    val email: String?,
    val phone: String?,
    val username: String,
    val location: String,
    val verified: Boolean
)
