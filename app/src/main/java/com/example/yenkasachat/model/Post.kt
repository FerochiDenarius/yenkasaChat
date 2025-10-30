package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Post(
    @SerializedName("_id")
    val postId: String,

    // Author info (populated)
    val userId: UserBasic,

    // Community (populated)
    val communityId: CommunityBasic,

    // Content
    val text: String,
    val imageUrl: String? = null,
    val videoUrl: String? = null,

    // ✅ New optional fields for multiple media + mentions
    val mediaUrls: List<String>? = null, // For posts with multiple images/videos
    val mentions: List<String>? = null,  // For highlighting @mentions

    // Engagement
    val likes: List<String> = emptyList(),
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val shareCount: Int = 0,
    val viewCount: Int = 0,

    // Status
    val isActive: Boolean = true,
    val isPinned: Boolean = false,
    val visibility: String = "public",

    // Tags
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

data class UserBasic(
    @SerializedName("_id")
    val id: String,
    val username: String,
    val profileImage: String? = null,
    val verified: Boolean = false
)

data class CommunityBasic(
    @SerializedName("_id")
    val id: String,
    val name: String,
    val displayName: String
)

data class CreatePostRequest(
    val text: String,
    val imageUrl: String? = null,
    val videoUrl: String? = null,
    val tags: List<String> = emptyList(),
    val location: String? = null,
    val visibility: String = "public"
)

data class CreatePostResponse(
    val success: Boolean,
    val message: String,
    val post: Post,
    val coinsEarned: Int = 0
)

data class FeedResponse(
    val posts: List<Post>,
    val pagination: PaginationInfo
)

data class PaginationInfo(
    val currentPage: Int,
    val totalPages: Int,
    val totalPosts: Int = 0,
    val hasMore: Boolean
)

data class LikeResponse(
    val success: Boolean,
    val liked: Boolean,
    val likeCount: Int,
    val coinsRewarded: Int = 0
)

data class DeletePostResponse(
    val success: Boolean,
    val message: String
)
