package xyz.yenkasa.app.model

data class PhoneRequest(
    val phone: String
)

data class ConfirmPhoneRequest(
    val phone: String,
    val code: String
)
