package xyz.yenkasa.app.model

data class MonetizationEventRequest(
    val eventType: String,
    val placement: String,
    val adId: String? = null,
    val postId: String? = null,
    val durationMs: Int? = null,
    val skipped: Boolean = false,
    val completed: Boolean = false,
    val rewarded: Boolean = false,
    val monetizedSession: Boolean = false,
    val platform: String = "android"
)

data class MonetizationEventResponse(
    val success: Boolean,
    val message: String? = null,
    val metrics: MonetizationDailyMetrics? = null
)

data class MonetizationDailyMetrics(
    val date: String? = null,
    val platform: String? = null,
    val country: String? = null,
    val totalAdImpressions: Int = 0,
    val rewardedAdsCompleted: Int = 0,
    val midRollAdsShown: Int = 0,
    val interstitialAdsShown: Int = 0,
    val adWatchDuration: Long = 0L,
    val skippedAds: Int = 0,
    val monetizedPlaybackSessions: Int = 0
)
