package xyz.yenkasa.app.network.model

import com.google.gson.annotations.SerializedName

data class ToggleLikeResponse(
    @SerializedName("likedByUser")
    val likedByUser: Boolean,

    @SerializedName("likesCount")
    val likesCount: Int
)