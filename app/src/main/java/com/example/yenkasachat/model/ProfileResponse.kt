package com.example.yenkasachat.model

data class ProfileResponse(
    // Define all fields your backend returns for a profile
    val _id: String,
    val username: String,
    val email: String,
    val phone: String?,
    val location: String?,
    val profileImage: String?,
    val verified: Boolean?,

    // ✅ ADD THESE THREE LINES
    val followers: List<String>?,
    val following: List<String>?,
    val posts: List<Post>
    // ... any other fields
)
