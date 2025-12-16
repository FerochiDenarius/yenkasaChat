package xyz.yenkasa.app.model

data class ResetPasswordRequest(
    val newPassword: String
)

data class ChangePasswordRequest(
    val oldPassword: String,
    val newPassword: String
)
