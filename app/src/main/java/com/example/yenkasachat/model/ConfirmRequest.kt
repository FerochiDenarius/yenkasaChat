package com.example.yenkasachat.model

data class ConfirmRequest(
    val email: String? = null,
    val phone: String? = null,
    val code: String
)