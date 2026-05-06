package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class EconomySummaryResponse(
    val success: Boolean = false,
    val summary: EconomySummary? = null,
    val error: String? = null
)

data class EconomySummary(
    val month: String? = null,
    val totalRevenue: Double? = null,
    val rewardPool: Double? = null,
    val totalEligibleYkc: Double? = null,
    val ykcValue: Double? = null,
    val totalQualifiedViews: Double? = null,
    val totalWatchTime: Double? = null,
    val totalMonetizableOpportunities: Double? = null,
    val totalImpressions: Double? = null,
    val totalRequests: Double? = null,
    val ecpm: Double? = null,
    val fillRate: Double? = null,
    val activeUsers: Double? = null,
    val calculatedAt: String? = null
)

data class TopCreatorsResponse(
    val success: Boolean = false,
    val month: String? = null,
    val summary: EconomySummary? = null,
    val creators: List<TopCreator> = emptyList(),
    val topCreators: List<TopCreator> = emptyList(),
    val error: String? = null
)

data class TopCreator(
    val userId: String? = null,
    @SerializedName("_id") val id: String? = null,
    val username: String? = null,
    val profileImage: String? = null,
    val walletId: String? = null,
    val ykcEarnedThisMonth: Double? = null,
    val totalQualifiedViews: Double? = null,
    val totalWatchTime: Double? = null,
    val estimatedMonetizableOpportunities: Double? = null,
    val estimatedPayout: Double? = null
)

data class FraudAlertsResponse(
    val success: Boolean = false,
    val suspiciousLogs: List<FraudAlertLog> = emptyList(),
    val duplicatePatterns: List<FraudDuplicatePattern> = emptyList(),
    val alerts: List<FraudAlertLog> = emptyList(),
    val error: String? = null
)

data class FraudAlertLog(
    @SerializedName("_id") val id: String? = null,
    val userId: FraudAlertUser? = null,
    val postId: String? = null,
    val action: String? = null,
    val watchDuration: Double? = null,
    val qualifiedView: Boolean? = null,
    val monetizableOpportunity: Boolean? = null,
    val ipAddress: String? = null,
    val deviceId: String? = null,
    val timestamp: String? = null
)

data class FraudAlertUser(
    @SerializedName("_id") val id: String? = null,
    val username: String? = null,
    val profileImage: String? = null,
    val walletId: String? = null
)

data class FraudDuplicatePattern(
    @SerializedName("_id") val id: Map<String, String?>? = null,
    val count: Int? = null,
    val lastSeen: String? = null
)
