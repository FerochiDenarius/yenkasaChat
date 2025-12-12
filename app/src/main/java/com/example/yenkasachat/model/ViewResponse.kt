package com.example.yenkasachat.model

data class ViewResponse(
    val success: Boolean,
    val message: String? = null,
    val viewsCount: Int = 0,
    val rewardAmount: Int? = 0,
    val rewardTransaction: RewardTransaction? = null,
    val view: ViewData? = null
)

data class ViewData(
    val _id: String,
    val postId: String,
    val userId: String,
    val activityId: String,
    val username: String? = null,
    val watchDuration: Int? = 0,
    val viewedAt: String
)

data class RewardTransaction(
    val _id: String? = null,
    val userId: String? = null,
    val type: String? = null,
    val description: String? = null,
    val relatedPostId: String? = null,
    val amount: Int? = null,
    val activityId: String? = null,
    val createdAt: String? = null
)
data class ViewRequest(
    val watchDuration: Int,
    val mediaType: String // must be EXACT name backend expects
)



data class TrackAdViewResponse(
    val success: Boolean,
    val message: String? = null,
    val rewardAmount: Int? = null
)
