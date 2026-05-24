package xyz.yenkasa.app.yme

data class YmeEventPayload(
    val userId: String,
    val sourceApp: String = "social_app",
    val eventType: String,
    val sessionId: String,
    val clientEventId: String,
    val conversationId: String? = null,
    val contentId: String? = null,
    val creatorId: String? = null,
    val relatedUserId: String? = null,
    val communityId: String? = null,
    val postId: String? = null,
    val messageId: String? = null,
    val text: String? = null,
    val query: String? = null,
    val tags: List<String> = emptyList(),
    val categories: List<String> = emptyList(),
    val payload: Map<String, @JvmSuppressWildcards Any?> = emptyMap(),
    val durationMs: Long? = null,
    val watchTimeMs: Long? = null,
    val scrollDurationMs: Long? = null,
    val feedDwellMs: Long? = null,
    val engagementValue: Double? = null,
    val scrollSpeed: Double? = null,
    val skipSpeed: Double? = null,
    val rewatchCount: Int? = null,
    val impressionId: String? = null,
    val appVersion: String? = null,
    val clientPlatform: String = "android",
    val occurredAt: String,
)

data class YmeBatchRequest(
    val events: List<YmeEventPayload>,
)

data class YmeDispatch(
    val queued: Boolean? = null,
    val mode: String? = null,
    val reason: String? = null,
)

data class YmeEventResult(
    val skipped: Boolean? = null,
    val dispatch: YmeDispatch? = null,
)

data class YmeBatchResponse(
    val success: Boolean = false,
    val count: Int? = null,
    val results: List<YmeEventResult> = emptyList(),
)
