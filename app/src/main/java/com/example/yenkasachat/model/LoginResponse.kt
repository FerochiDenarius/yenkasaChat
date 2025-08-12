package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class LoginResponse(
    @SerializedName("user") // Good practice to keep @SerializedName even if field name matches JSON key
    val user: AuthUser,

    @SerializedName("token") // This is your access token
    val token: String,

    @SerializedName("refreshToken") // Assuming the JSON key from your backend will be "refreshToken"
    val refreshToken: String? // <<<< ADDED THIS LINE (nullable)
)

data class AuthUser(
    @SerializedName("_id")
    val _id: String,
    val email: String?,
    val phone: String?,
    val username: String,
    val location: String,
    val verified: Boolean,
    val playerId: String? // This field is for player ID on the user object, not a token
)