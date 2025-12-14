package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

/**
 * Represents the entire JSON object returned by the server upon successful login.
 */
data class LoginResponse(
    @SerializedName("token")
    val token: String? = null,

    @SerializedName("refreshToken")
    val refreshToken: String? = null,

    @SerializedName("user")
    val user: User? = null
)

