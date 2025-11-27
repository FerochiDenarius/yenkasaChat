package com.example.yenkasachat.model

data class CommunityVisibilityModel(
    val communityId: String,
    val name: String,
    val icon: String?,
    val isBlocked: Boolean // true → can't see posts
)

data class BlockCommunityRequest(
    val communityId: String
)
