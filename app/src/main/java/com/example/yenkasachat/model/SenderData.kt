package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class SenderData(
    @SerializedName("_id")
    val id: String?, // Maps to the _id field within the populated senderId object

    @SerializedName("username")
    val username: String?,

    @SerializedName("profileImage") // Matches 'profileImage' from your backend populate select
    // Make sure your User model in backend uses 'profileImage'
    // If it's 'profileImageUrl', change this SerializedName too.
    val profileImage: String?
)
