package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("_id")
    val _id: String,
    val username: String,
    val email: String?,
    val phone: String?,
    val location: String,
    val verified: Boolean,
    val token: String? = null,
    val profileImage: String?
)
