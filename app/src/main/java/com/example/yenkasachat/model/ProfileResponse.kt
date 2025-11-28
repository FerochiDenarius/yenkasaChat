package com.example.yenkasachat.model

data class ProfileResponse(
    val _id: String,
    val username: String,
    val email: String?,
    val phone: String?,
    val location: String?,
    val profileImage: String?,
    val verified: Boolean?,

    // ✅ Updated: followers & following are lists of UserSummary, not strings
    val followers: List<UserSummary> = emptyList(),
    val following: List<UserSummary> = emptyList(),

    // ✅ Optional: include posts if backend sends them (else leave empty)
    val posts: List<Post> = emptyList(),

    val isFollowing: Boolean = false,
    val isBlocked: Boolean = false,

    // ✅ Add these for richer future use
    val coinsBalance: Int? = null,
    val walletId: String? = null,
    val bio: String? = null,
    val community: CommunitySummary? = null,
    val followersCount: Int? = null,
    val followingCount: Int? = null
)

data class UserSummary(
    val _id: String,
    val username: String,
    val profileImage: String?
)

data class CommunitySummary(
    val _id: String,
    val name: String?
)


