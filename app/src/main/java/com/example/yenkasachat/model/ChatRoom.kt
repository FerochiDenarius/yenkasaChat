package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class ChatRoom(
    @SerializedName("_id")
    val _id: String,  // <-- use _id here for MongoDB consistency

    val participants: List<User>,
    val lastMessage: String? = null
)
