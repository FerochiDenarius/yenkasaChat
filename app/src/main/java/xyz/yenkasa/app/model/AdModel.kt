package xyz.yenkasa.app.model

/**
 * Represents an advertisement item returned from the backend
 * and displayed in the FeedAdapter.
 *
 * Supports:
 *  - Image ads
 *  - Video ads
 *  - Google reward-trigger ads
 *  - Sponsor/internal ads
 *  - CTA buttons
 */
data class AdModel(
    val _id: String,

    val title: String? = null,

    // MEDIA
    val imageUrl: String? = null,
    val videoUrl: String? = null,
    val thumbnailUrl: String? = null,   // ⭐ REQUIRED FOR VIDEO PREVIEW

    // AD TYPE: "google", "sponsor", "internal"
    val adType: String? = null,

    // WATCH-TO-EARN
    val rewardYKC: Int = 5,

    // CTA BUTTON
    val ctaText: String? = null,
    val ctaUrl: String? = null,

    // SPONSOR DATA
    val sponsorName: String? = null,
    val campaignId: String? = null
)


data class AdCreateRequest(
    val title: String,
    val ctaText: String?,
    val ctaUrl: String?,
    val rewardAmount: Int
)
data class AdCreateResponse(
    val success: Boolean,
    val message: String? = null,
    val adId: String? = null
)

data class AdsFeedResponse(
    val success: Boolean,
    val ads: List<AdModel>
)