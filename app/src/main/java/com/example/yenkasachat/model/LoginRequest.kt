package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    @SerializedName("identifier") // or use "usernameOrPhone" if that's what the backend expects
    val identifier: String,

    val password: String
)
