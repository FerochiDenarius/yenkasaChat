package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Participant(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String?, // May be null

    @SerializedName("profileImage")
    val profileImage: String?, // May be null

    @SerializedName("isOnline")
    val isOnline: Boolean? = false // New field for online/offline status
)
