package xyz.yenkasa.app.model

data class UserResponse(
    val success: Boolean,
    val message: String?,
    val user: User?
)
