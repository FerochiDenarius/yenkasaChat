package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class TokenResponse(
    @SerializedName("accessToken")
    val token: String,

    @SerializedName("refreshToken")
    val refreshToken: String
)
