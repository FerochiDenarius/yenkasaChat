package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class RegisterRequest(
    val email: String?,
    @SerializedName("phoneNumber")
    val phone: String?,
    val username: String,
    val location: String,
    val password: String,
    val communityId: String,
    val country: String = "Ghana"
)
