package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String?,

    @SerializedName("phoneNumber")
    val phoneNumber: String?,

    @SerializedName("location")
    val location: String?,

    @SerializedName("verified")
    val verified: Boolean,

    @SerializedName("profileImage")
    val profileImage: String?,

    @SerializedName("coinsBalance")
    val coinsBalance: Int = 0,

    @SerializedName("walletId")
    val walletId: String, // 🪙 Added field to match backend

    @SerializedName("community")
    val community: Community?,

    @SerializedName("createdAt")
    val createdAt: String,

    @SerializedName("role")
    val role: String,

    @SerializedName("permissions")
    val permissions: Permissions,

    @SerializedName("followers")
    val followers: List<String>? = emptyList(),

    @SerializedName("following")
    val following: List<String>? = emptyList()
)
