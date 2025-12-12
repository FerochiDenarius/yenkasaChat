package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

// ===================== Feed Models =====================

// Feed response from API
data class FeedResponse(
    val posts: List<Post>,          // list of posts
    val pagination: PaginationInfo  // pagination info
)

// Like/unlike response
data class FeedItem(
    val __isAd: Boolean = false,
    val post: Post? = null,
    val ad: AdModel? = null
)

