package com.example.yenkasachat.model

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

    // AD TYPE: "google", "sponsor", "internal"
    val adType: String? = null,

    // WATCH-TO-EARN reward
    val rewardYKC: Int = 5,



    // CTA BUTTON
    val ctaText: String? = null,   // e.g. "Learn More"
    val ctaUrl: String? = null,    // e.g. "https://example.com"

    // Extra metadata (optional)
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
