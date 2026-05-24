package xyz.yenkasa.app.yme

import android.content.Context
import java.util.concurrent.ConcurrentHashMap
import xyz.yenkasa.app.model.Post

object YmeAnalyticsManager {
    @Volatile
    private var tracker: YmeEventTracker? = null
    private val viewCounts = ConcurrentHashMap<String, Int>()

    fun initialize(context: Context) {
        if (tracker != null) return
        synchronized(this) {
            if (tracker == null) {
                tracker = YmeEventTracker(
                    context = context.applicationContext,
                    sessionManager = YmeSessionManager(context.applicationContext),
                )
            }
        }
    }

    fun trackNotificationOpen(notificationType: String?, targetId: String?) {
        tracker()?.track(
            eventType = "notification_open",
            relatedUserId = null,
            payload = mapOf(
                "notificationType" to notificationType.orEmpty(),
                "targetId" to targetId.orEmpty(),
            ),
            dedupeWindowMs = 3_000L,
        )
    }

    fun trackPostView(post: Post, mediaType: String, impressionId: String? = null) {
        val priorViews = viewCounts[post._id] ?: 0
        viewCounts[post._id] = priorViews + 1
        tracker()?.track(
            eventType = if (mediaType == "video" || mediaType == "audio") "video_watch" else "post_view",
            contentId = post._id,
            creatorId = post.userId.id,
            communityId = post.communityId?.id,
            postId = post._id,
            text = post.caption,
            tags = post.tags,
            payload = mapOf("mediaType" to mediaType),
            rewatchCount = priorViews,
            impressionId = impressionId,
            dedupeWindowMs = 8_000L,
        )
    }

    fun trackWatchDuration(post: Post, watchMs: Long, feedDwellMs: Long = watchMs, skipSpeed: Double = 0.0) {
        if (watchMs < 1_000L) return
        tracker()?.track(
            eventType = "watch_duration",
            contentId = post._id,
            creatorId = post.userId.id,
            communityId = post.communityId?.id,
            postId = post._id,
            text = post.caption,
            tags = post.tags,
            payload = mapOf(
                "mediaType" to mediaTypeFor(post),
                "watchSeconds" to (watchMs / 1000.0),
            ),
            watchTimeMs = watchMs,
            feedDwellMs = feedDwellMs,
            skipSpeed = skipSpeed,
            dedupeWindowMs = 2_000L,
        )
    }

    fun trackLiveStreamJoin(streamId: String, creatorId: String? = null, communityId: String? = null) {
        tracker()?.track(
            eventType = "live_stream_join",
            contentId = streamId,
            creatorId = creatorId,
            communityId = communityId,
            payload = mapOf("streamId" to streamId),
            dedupeWindowMs = 10_000L,
        )
    }

    fun trackCommunityJoin(communityId: String, communityName: String? = null) {
        tracker()?.track(
            eventType = "community_join",
            communityId = communityId,
            payload = mapOf(
                "communityId" to communityId,
                "communityName" to communityName.orEmpty(),
            ),
            dedupeWindowMs = 12_000L,
        )
    }

    fun trackRewardClaim(
        source: String,
        rewardType: String? = null,
        amount: Double? = null,
        targetId: String? = null,
        communityId: String? = null,
        postId: String? = null,
    ) {
        tracker()?.track(
            eventType = "reward_claim",
            contentId = targetId,
            communityId = communityId,
            postId = postId,
            payload = mapOf(
                "source" to source,
                "rewardType" to rewardType.orEmpty(),
                "amount" to (amount ?: 0.0),
                "targetId" to targetId.orEmpty(),
            ),
            dedupeWindowMs = 4_000L,
        )
    }

    fun trackCreatorToolUse(
        toolName: String,
        targetId: String? = null,
        communityId: String? = null,
        creatorId: String? = null,
    ) {
        tracker()?.track(
            eventType = "creator_interaction",
            contentId = targetId,
            creatorId = creatorId,
            communityId = communityId,
            payload = mapOf(
                "toolName" to toolName,
                "targetId" to targetId.orEmpty(),
                "communityId" to communityId.orEmpty(),
            ),
            dedupeWindowMs = 8_000L,
        )
    }

    fun trackAnalyticsInteraction(
        action: String,
        targetId: String? = null,
    ) {
        tracker()?.track(
            eventType = "creator_interaction",
            contentId = targetId,
            payload = mapOf(
                "action" to action,
                "targetId" to targetId.orEmpty(),
                "surface" to "analytics",
            ),
            dedupeWindowMs = 8_000L,
        )
    }

    fun trackRawEvent(
        eventType: String,
        payload: Map<String, Any?> = emptyMap(),
        dedupeWindowMs: Long = 6_000L,
    ) {
        tracker()?.track(
            eventType = eventType,
            payload = payload,
            dedupeWindowMs = dedupeWindowMs,
        )
    }

    private fun tracker(): YmeEventTracker? = tracker

    private fun mediaTypeFor(post: Post): String {
        return when {
            !post.videoUrl.isNullOrBlank() -> "video"
            !post.audioUrl.isNullOrBlank() -> "audio"
            post.effectiveImageUrls().isNotEmpty() -> "image"
            else -> "text"
        }
    }
}
