package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

// ===================== Feed Models =====================

// Feed response from API
data class FeedResponse(
    val posts: List<Post>,          // list of posts
    val pagination: PaginationInfo  // pagination info
)

// Like/unlike response
data class LikeResponse(
    val message: String,                                 // e.g. "Post liked" or "Post unliked"
    @SerializedName("likedByUser") val liked: Boolean,   // true if the user now likes the post
    @SerializedName("likesCount") val likeCount: Int,    // updated like count
    val coinsRewarded: Int = 0                           // optional: reward field, defaults to 0
)
