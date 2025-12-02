package com.example.yenkasachat.model

// ===============================
// MAIN DASHBOARD RESPONSE MODEL
// ===============================
data class VerificationDashboard(
    val detailsVerification: DetailsVerification,
    val appVerification: AppVerification,

    // Explicit role (fallback from backend)
    val userRole: String? = null,

    // Developer bypass flag
    val developerOverride: Boolean? = false,

    // NEW — full user performance metrics (optional)
    val performanceMetrics: UserPerformanceMetrics? = null
)


// ===============================
// DETAILS VERIFICATION
// ===============================
data class DetailsVerification(
    val email: Boolean,
    val phone: Boolean,
    val basicPostingEnabled: Boolean,

    // NEW: backend includes the user's role
    val userRole: String? = null
)


// ===============================
// APP VERIFICATION CORE
// ===============================
data class AppVerification(
    val currentPhase: Int,
    val hasVerifiedBanner: Boolean,
    val phaseStartDate: String? = null,
    val phaseEndDate: String? = null,
    val daysRemaining: Int,

    val requirements: VerificationRequirements,
    val currentMetrics: VerificationMetrics,
    val progress: VerificationProgress,
    val phaseHistory: List<PhaseHistory>
)


// ===============================
// REQUIREMENTS MODEL
// ===============================
data class VerificationRequirements(
    val accountAge: Int,
    val comments: Int,
    val followers: Int,
    val maxLikes: Int,
    val dailyLogins: Int,
    val adsViewed: Int,

    // Optional scalability for moderator/admin/developer
    val roleMultiplier: Float? = 1.0f
)


// ===============================
// UPDATED METRICS (BACKEND V2)
// ===============================
data class VerificationMetrics(

    // ----- CORE -----
    var accountAge: Int,
    var totalComments: Int,
    var totalFollowers: Int,
    var maxLikesOnPost: Int,
    var dailyLogins: Int,
    var adsViewed: Int,

    // ----- RECEIVED METRICS -----
    var postsCreated: Int = 0,
    var totalViewsReceived: Int = 0,
    var totalRepliesReceived: Int = 0,
    var totalLikesReceived: Int = 0,
    var totalCommentsReceived: Int = 0,
    var commentLikesReceived: Int = 0,
    var totalShares: Int = 0,

    // ----- SOCIAL -----
    var totalFollowing: Int = 0,

    // ----- ACTIVITY METRICS (added as vars) -----
    var totalPostCount: Int = 0,
    var totalViewsCount: Int = 0,
    var totalLikesCount: Int = 0,       // <--- Missing one (FIXED)
    var totalCommentsMade: Int = 0
)



// ===============================
// PROGRESS MODEL
// ===============================
data class VerificationProgress(
    val accountAge: Boolean,
    val comments: Boolean,
    val followers: Boolean,
    val maxLikes: Boolean,
    val dailyLogins: Boolean,
    val adsViewed: Boolean,

    // Whether all requirements have been completed
    val allMet: Boolean
)


// ===============================
// USER PERFORMANCE METRICS
// ===============================
data class UserPerformanceMetrics(
    val followers: Int = 0,
    val postsCreated: Int = 0,
    val likesReceived: Int = 0,
    val viewsReceived: Int = 0,
    val commentsReceived: Int = 0,
    val repliesReceived: Int = 0,
    val commentLikesReceived: Int = 0,
    val totalShares: Int = 0
)


// ===============================
// PHASE HISTORY ITEM
// ===============================
data class PhaseHistory(
    val phase: Int,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val completed: Boolean = false
)

// ===============================
// TRACK LOGIN RESPONSE
// ===============================
data class TrackLoginResponse(
    val success: Boolean,
    val newDayLogged: Boolean,
    val dailyLogins: Int
)


// ===============================
// TRACK AD VIEW RESPONSE
// ===============================
data class TrackAdViewResponse(
    val success: Boolean,
    val adsViewed: Int
)


// ===============================
// VERIFICATION PROGRESS RESPONSE
// ===============================
data class VerificationProgressResponse(
    val phase: Int,
    val overallProgress: Int,
    val detailedProgress: DetailedProgress,
    val requirements: VerificationRequirements,
    val currentMetrics: VerificationMetrics
)

data class DetailedProgress(
    val accountAge: Float,
    val comments: Float,
    val followers: Float,
    val maxLikes: Float,
    val dailyLogins: Float,
    val adsViewed: Float
)


// ===============================
// PHASE ADVANCEMENT RESPONSE
// ===============================
data class PhaseAdvancementResponse(
    val success: Boolean,
    val message: String,
    val newPhase: Int? = null,
    val hasVerifiedBanner: Boolean? = null,
    val nextRequirements: VerificationRequirements? = null,
    val error: String? = null,
    val daysRemaining: Int? = null
)


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
