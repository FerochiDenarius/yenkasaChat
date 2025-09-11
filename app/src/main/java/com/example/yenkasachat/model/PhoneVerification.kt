package com.example.yenkasachat.model

data class PhoneRequest(
    val phone: String
)

data class ConfirmPhoneRequest(
    val phone: String,
    val code: String
)
