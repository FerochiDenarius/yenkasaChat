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

data class AdModel(
    val _id: String,
    val title: String?,
    val imageUrl: String?,
    val videoUrl: String?,
    val adType: String, // google | sponsor | internal
    val ctaText: String?,
    val ctaUrl: String?,
    val rewardYKC: Int = 5
)
