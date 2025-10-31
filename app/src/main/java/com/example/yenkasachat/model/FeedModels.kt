package com.example.yenkasachat.model

// ===================== Feed Models =====================

// Pagination info for feed responses


// Feed response from API
data class FeedResponse(
    val posts: List<Post>,          // list of posts
    val pagination: PaginationInfo  // pagination info
)

// Like/unlike response
data class LikeResponse(
    val success: Boolean,           // was the request successful
    val liked: Boolean,             // true if user now likes the post
    val likeCount: Int,             // updated like count
    val coinsRewarded: Int = 0      // optional coins rewarded for author
)
