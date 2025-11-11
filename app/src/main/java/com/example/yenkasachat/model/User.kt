package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String? = null,

    @SerializedName("phone")
    val phone: String? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("verified")
    val verified: Boolean = false,

    @SerializedName("profileImage")
    val profileImage: String? = null,

    @SerializedName("coinsBalance")
    val coinsBalance: Int = 0,

    @SerializedName("community")
    val community: Community? = null,

    @SerializedName("walletId")
    val walletId: String? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null,

    @SerializedName("updatedAt")
    val updatedAt: String? = null,

    // ✅ Role is now an object
    @SerializedName("role")
    val role: Role? = null,

    @SerializedName("followers")
    val followers: List<String>? = emptyList(),

    @SerializedName("following")
    val following: List<String>? = emptyList()
)

// ✅ Role model to match backend
