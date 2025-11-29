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

    // --- Original metrics ---
    val accountAge: Int,
    val totalComments: Int,
    val totalFollowers: Int,
    val maxLikesOnPost: Int,
    val dailyLogins: Int,
    val adsViewed: Int,

    // --- NEW BE metrics ---
    val postsCreated: Int? = 0,
    val viewsReceived: Int? = 0,
    val repliesReceived: Int? = 0,

    // --- Performance metrics from getUserPerformanceMetrics ---
    val likesReceived: Int? = 0,
    val commentsReceived: Int? = 0,
    val commentLikesReceived: Int? = 0,
    val totalShares: Int? = 0
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
