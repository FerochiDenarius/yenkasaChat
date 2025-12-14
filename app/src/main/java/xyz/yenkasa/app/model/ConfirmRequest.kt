package xyz.yenkasa.app.model

data class ConfirmRequest(
    val email: String? = null,
    val phone: String? = null,
    val code: String
)