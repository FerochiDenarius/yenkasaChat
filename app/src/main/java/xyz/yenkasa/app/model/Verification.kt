package xyz.yenkasa.app.model

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
    val currentPhase: Int? = null,
    val currentRank: String? = null,
    val currentRankKey: String? = null,
    val nextRank: String? = null,
    val nextRankKey: String? = null,
    val progressToNextRank: Int? = null,
    val rankingPeriodStatus: String? = null,
    val rankingPeriodLabel: String? = null,
    val officialPhaseStartDate: String? = null,
    val rankingLaunchDate: String? = null,
    val hasVerifiedBanner: Boolean,
    val phaseStartDate: String? = null,
    val phaseEndDate: String? = null,
    val daysRemaining: Int? = null,

    val requirements: VerificationRequirements,
    val currentMetrics: VerificationMetrics,
    val progress: VerificationProgress,
    val phaseHistory: List<PhaseHistory> = emptyList(),
    val activityMetrics: ActiveRankingMetrics? = null,
    val performanceMetrics: AnalyticsOnlyMetrics? = null,
    val activeRankingMetrics: ActiveRankingMetrics? = null,
    val analyticsOnlyMetrics: AnalyticsOnlyMetrics? = null
)


// ===============================
// REQUIREMENTS MODEL
// ===============================
data class VerificationRequirements(
    val accountAge: Int = 0,
    val commentsMade: Int = 0,
    val following: Int = 0,
    val likesGiven: Int = 0,
    val dailyLogins: Int = 0,
    val adsViewed: Int = 0,
    val followers: Int = 0,
    val commentsReceived: Int = 0,
    val comments: Int = 0,
    val maxLikes: Int = 0,

    // Optional scalability for moderator/admin/developer
    val roleMultiplier: Float? = 1.0f
)


// ===============================
// UPDATED METRICS (BACKEND V2)
// ===============================
data class VerificationMetrics(

    var accountAge: Int = 0,

    var totalComments: Int = 0,
    var totalCommentsMade: Int = 0,

    var totalFollowers: Int = 0,
    var totalFollowing: Int = 0,

    var maxLikesOnPost: Int = 0,
    var totalLikesCount: Int = 0,
    var commentLikesReceived: Int = 0,

    var dailyLogins: Int = 0,
    var adsViewed: Int = 0,

    var postsCreated: Int = 0,
    var totalPostCount: Int = 0,
    var postsLiked: Int = 0,

    var totalViewsReceived: Int = 0,
    var totalViewsCount: Int = 0,
    var totalViewsMade: Int = 0,

    var totalRepliesReceived: Int = 0,
    var repliesMade: Int = 0,

    var totalCommentsReceived: Int = 0,

    var totalShares: Int = 0,
    var sharesMade: Int = 0,

    var totalLikesReceived: Int = 0,

    var profilesVisited: Int = 0,
    var communitiesJoined: Int = 0,
    var communitiesEngaged: Int = 0,

    var reportsMade: Int = 0,
    var validReports: Int = 0
)





// ===============================
// PROGRESS MODEL
// ===============================
data class VerificationProgress(
    val accountAge: Boolean = false,
    val commentsMade: Boolean = false,
    val following: Boolean = false,
    val likesGiven: Boolean = false,
    val dailyLogins: Boolean = false,
    val adsViewed: Boolean = false,
    val followers: Boolean = false,
    val commentsReceived: Boolean = false,
    val comments: Boolean = false,
    val maxLikes: Boolean = false,

    // Whether all requirements have been completed
    val allMet: Boolean = false
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

data class VerificationMetricUpdateRequest(
    val type: String,
    val value: Int? = null
)

data class VerificationMetricUpdateResponse(
    val success: Boolean,
    val metrics: VerificationMetrics? = null,
    val error: String? = null
)


// ===============================
// VERIFICATION PROGRESS RESPONSE
// ===============================
data class VerificationProgressResponse(
    val phase: Int? = null,
    val currentRank: String? = null,
    val nextRank: String? = null,
    val overallProgress: Int = 0,
    val detailedProgress: DetailedProgress,
    val requirements: VerificationRequirements,
    val currentMetrics: VerificationMetrics
)

data class DetailedProgress(
    val accountAge: Float = 0f,
    val commentsMade: Float = 0f,
    val following: Float = 0f,
    val likesGiven: Float = 0f,
    val dailyLogins: Float = 0f,
    val adsViewed: Float = 0f,
    val followers: Float = 0f,
    val commentsReceived: Float = 0f,
    val comments: Float = 0f,
    val maxLikes: Float = 0f
)


// ===============================
// PHASE ADVANCEMENT RESPONSE
// ===============================
data class PhaseAdvancementResponse(
    val success: Boolean,
    val message: String,
    val currentRank: String? = null,
    val nextRank: String? = null,
    val progressToNextRank: Int? = null,
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
    val postsLiked: Int = 0,
    val totalViewsCount: Int = 0,
    val totalViewsMade: Int = 0,
    val totalLikesCount: Int = 0,
    val maxLikesOnPost: Int = 0,
    val totalCommentsMade: Int = 0,
    val repliesMade: Int = 0,
    val sharesMade: Int = 0,

    // ----- COMMUNITY SUPPORT -----
    val profilesVisited: Int = 0,
    val communitiesJoined: Int = 0,
    val communitiesEngaged: Int = 0,

    // ----- TRUST / REVIEW -----
    val reportsMade: Int = 0,
    val validReports: Int = 0,

    // ----- SOCIAL -----
    val totalFollowers: Int = 0,
    val totalFollowing: Int = 0
)

data class ActiveRankingMetrics(
    val accountAge: Int = 0,
    val totalCommentsMade: Int = 0,
    val totalFollowing: Int = 0,
    val postsLiked: Int = 0,
    val totalLikesGiven: Int = 0,
    val dailyLogins: Int = 0,
    val adsViewed: Int = 0
)

data class AnalyticsOnlyMetrics(
    val totalFollowers: Int = 0,
    val totalLikesReceived: Int = 0,
    val totalViewsReceived: Int = 0,
    val totalCommentsReceived: Int = 0,
    val totalRepliesReceived: Int = 0,
    val maxLikesOnPost: Int = 0
)
