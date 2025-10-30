// app/src/main/java/com/example/yenkasachat/model/Verification.kt
package com.example.yenkasachat.model

data class VerificationDashboard(
    val detailsVerification: DetailsVerification,
    val appVerification: AppVerification
)

data class DetailsVerification(
    val email: Boolean,
    val phone: Boolean,
    val basicPostingEnabled: Boolean
)

data class AppVerification(
    val currentPhase: Int,
    val hasVerifiedBanner: Boolean,
    val phaseStartDate: String,
    val phaseEndDate: String,
    val daysRemaining: Int,
    val requirements: VerificationRequirements,
    val currentMetrics: VerificationMetrics,
    val progress: VerificationProgress,
    val phaseHistory: List<PhaseHistory>
)

data class VerificationRequirements(
    val accountAge: Int,
    val comments: Int,
    val followers: Int,
    val maxLikes: Int,
    val dailyLogins: Int,
    val adsViewed: Int
)

data class VerificationMetrics(
    val accountAge: Int,
    val totalComments: Int,
    val totalFollowers: Int,
    val maxLikesOnPost: Int,
    val dailyLogins: Int,
    val adsViewed: Int
)

data class VerificationProgress(
    val accountAge: Boolean,
    val comments: Boolean,
    val followers: Boolean,
    val maxLikes: Boolean,
    val dailyLogins: Boolean,
    val adsViewed: Boolean,
    val allMet: Boolean
)

data class PhaseHistory(
    val phase: Int,
    val achievedAt: String,
    val bannerAwarded: Boolean
)

data class TrackLoginResponse(
    val success: Boolean,
    val newDayLogged: Boolean,
    val dailyLogins: Int
)

data class TrackAdViewResponse(
    val success: Boolean,
    val adsViewed: Int
)

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

data class PhaseAdvancementResponse(
    val success: Boolean,
    val message: String,
    val newPhase: Int? = null,
    val hasVerifiedBanner: Boolean? = null,
    val nextRequirements: VerificationRequirements? = null,
    val error: String? = null,
    val daysRemaining: Int? = null
)