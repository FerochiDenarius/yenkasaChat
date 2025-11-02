package com.example.yenkasachat.model

data class JoinCommunityResponse(
    val success: Boolean,
    val message: String,
    val community: Community?
)


// model/JoinCommunityRequest.kt
data class JoinCommunityRequest(
    val userId: String,
    val communityIds: List<String>
)