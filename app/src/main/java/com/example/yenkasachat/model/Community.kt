// app/src/main/java/com/example/yenkasachat/model/Community.kt
package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Community(
    @SerializedName("_id")
    val id: String,

    val name: String,
    val displayName: String,
    val description: String,
    val location: String? = null,
    val categories: List<String> = emptyList(),

    val coverImage: String? = null,
    val icon: String? = null,

    val memberCount: Int = 0,
    val postCount: Int = 0,

    val isActive: Boolean = true,
    val isPrivate: Boolean = false,
    val isApproved: Boolean = true,

    @SerializedName("createdBy")
    val createdById: String? = null,

    val moderators: List<String> = emptyList(),
    val pinnedPosts: List<String> = emptyList(),

    val createdAt: String? = null,
    val updatedAt: String? = null
)

data class JoinCommunityResponse(
    val success: Boolean,
    val message: String,
    val community: CommunityInfo? = null
)

data class CommunityInfo(
    val id: String,
    val name: String,
    val displayName: String
)

data class CreateCommunityRequest(
    val name: String,
    val displayName: String,
    val description: String,
    val location: String? = null,
    val categories: List<String> = emptyList()
)

data class CreateCommunityResponse(
    val success: Boolean,
    val message: String,
    val community: CommunityInfo? = null,
    val note: String? = null
)