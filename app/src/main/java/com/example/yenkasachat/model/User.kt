package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class User(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username") // It's good practice to add SerializedName to all fields
    val username: String,

    @SerializedName("email")
    val email: String?,

    @SerializedName("phone")
    val phone: String?,

    @SerializedName("location")
    val location: String?, // Changed to nullable to be safer

    @SerializedName("verified")
    val verified: Boolean,

    @SerializedName("profileImage")
    val profileImage: String?,

    // This field is likely for client-side logic only, so no SerializedName is needed
    var unreadCount: Int = 0,

    // It's better not to include the token in a data model that is reused everywhere.
    // val token: String? = null, // This is usually handled by TokenManager, not stored in the User model.

    @SerializedName("followers")
    val followers: List<String>? = emptyList(), // List of user IDs

    @SerializedName("following")
    val following: List<String>? = emptyList() // List of user IDs
)
