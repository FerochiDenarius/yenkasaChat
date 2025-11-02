package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Post(
    @SerializedName("_id")
    val _id: String,                  // matches adapter references

    val userId: UserBasic,
    val communityId: CommunityBasic? = null,

    // Content
    @SerializedName("text")
    val caption: String,              // maps from 'text' in API
    val mediaUrl: String? = null,     // single media for adapter (image/video)
    val mediaUrls: List<String>? = null,
    val mentions: List<String>? = null,

    // ✅ Added because some adapters and older posts use it
    val imageUrl: String? = null,

    // Engagement
    val likes: List<String> = emptyList(),
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val comments: List<Comment>? = null,
    val shareCount: Int = 0,
    val viewCount: Int = 0,

    // Status
    val isActive: Boolean = true,
    val isPinned: Boolean = false,
    val visibility: String = "public",

    // ✅ NEW: post approval status
    @SerializedName("status")
    val status: String? = null,       // "approved", "pending", "rejected"

    // ✅ NEW: convenience flag
    @SerializedName("isApproved")
    val isApproved: Boolean = false,  // optional but nice for quick checks

    // Tags & location
    val tags: List<String> = emptyList(),
    val location: String? = null,

    // Coins
    val coinsEarned: Int = 0,

    // Timestamps
    val createdAt: String,
    val updatedAt: String? = null,

    // Client-side flag
    var likedByCurrentUser: Boolean = false
)

