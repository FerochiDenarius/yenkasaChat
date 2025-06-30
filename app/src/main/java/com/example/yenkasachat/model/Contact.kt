package com.example.yenkasachat.model

data class Contact(
    val id: String,
    val userId: String,
    val username: String,
    val location: String,
    val profileImage: String? = null
)
