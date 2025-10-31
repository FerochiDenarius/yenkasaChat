package com.example.yenkasachat.model

data class JoinCommunityResponse(
    val success: Boolean,
    val message: String,
    val community: Community?
)
