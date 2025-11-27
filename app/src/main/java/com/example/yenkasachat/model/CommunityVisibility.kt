package com.example.yenkasachat.model

data class CommunityVisibilityModel(
    val communityId: String,
    val communityName: String,
    var blockUsers: Boolean = false,
    var exceptFollowers: Boolean = false
)


data class BlockCommunityRequest(
    val communityId: String
)
