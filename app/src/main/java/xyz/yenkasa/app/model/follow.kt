package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class Follow(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("userId")
    val userId: String, // who follows or who is being followed

    @SerializedName("followedId")
    val followedId: String? = null, // optional if backend provides it

    @SerializedName("timestamp")
    val timestamp: String
)