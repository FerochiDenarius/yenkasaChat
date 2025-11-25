package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class User(

    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String? = null,

    // 🔥 Backend uses phoneNumber, NOT phone
    @SerializedName("phoneNumber")
    val phone: String? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("verified")
    val verified: Boolean = false,

    @SerializedName("profileImage")
    val profileImage: String? = null,

    @SerializedName("coinsBalance")
    val coinsBalance: Int = 0,

    // 🔥 Backend now sends community AS AN OBJECT
    @SerializedName("community")
    val community: Community? = null,

    @SerializedName("walletId")
    val walletId: String? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null,

    @SerializedName("updatedAt")
    val updatedAt: String? = null,

    // 🔥 Role is an object with name + permissions
    @SerializedName("role")
    val role: Role? = null,

    // Provided separately in backend too
    @SerializedName("roleName")
    val roleName: String? = null,

    @SerializedName("followers")
    val followers: List<String>? = emptyList(),

    @SerializedName("following")
    val following: List<String>? = emptyList()
)
