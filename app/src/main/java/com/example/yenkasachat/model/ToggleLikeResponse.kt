package com.example.yenkasachat.network.model

import com.google.gson.annotations.SerializedName

data class ToggleLikeResponse(
    @SerializedName("likedByUser")
    val likedByUser: Boolean,

    @SerializedName("likesCount")
    val likesCount: Int
)