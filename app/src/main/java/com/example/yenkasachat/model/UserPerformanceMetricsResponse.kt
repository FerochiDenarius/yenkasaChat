package com.example.yenkasachat.model

data class UserPerformanceMetricsResponse(
    val success: Boolean,
    val performanceMetrics: PerformanceTotals
)

data class PerformanceTotals(
    // ----- RECEIVED METRICS -----
    val totalViewsReceived: Int = 0,
    val totalLikesReceived: Int = 0,
    val totalCommentsReceived: Int = 0,
    val totalRepliesReceived: Int = 0,
    val commentLikesReceived: Int = 0,
    val totalShares: Int = 0,

    // ----- ACTIVITY METRICS -----
    val postsCreated: Int = 0,
    val totalPostCount: Int = 0,
    val totalViewsCount: Int = 0,
    val totalLikesCount: Int = 0,
    val totalCommentsMade: Int = 0,

    // ----- SOCIAL -----
    val totalFollowers: Int = 0,
    val totalFollowing: Int = 0
)
