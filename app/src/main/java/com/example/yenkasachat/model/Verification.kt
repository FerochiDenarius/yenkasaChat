// app/src/main/java/com/example/yenkasachat/model/Verification.kt
package com.example.yenkasachat.model

data class VerificationDashboard(
    val detailsVerification: DetailsVerification,
    val appVerification: AppVerification,
    val userRole: String? = null, // ✅ Added: Role information (admin, moderator, developer, user)
    val developerOverride: Boolean? = false // ✅ Added: Developer bypass flag for UI logic
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
    val adsViewed: Int,
    val roleMultiplier: Float? = 1.0f // ✅ Added: Used if backend scales requirements (e.g., moderator ×1.8)
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

// ✅ Added optional role-based verification model (non-breaking)
data class RoleVerificationProfile(
    val roleName: String,
    val baseRequirements: VerificationRequirements,
    val effectiveRequirements: VerificationRequirements,
    val canBypassRules: Boolean = false
)
