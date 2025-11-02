package com.example.yenkasachat.model

data class FollowResponse(
    val success: Boolean,
    val message: String,
    val isFollowing: Boolean? = null,
    val followersCount: Int? = null,
    val followingCount: Int? = null,
    val coinsRewarded: Int? = null,
    val timestamp: String? = null
)
