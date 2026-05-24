package xyz.yenkasa.app.yme

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import xyz.yenkasa.app.BuildConfig
import xyz.yenkasa.app.util.TokenManager

class YmeEventTracker(
    context: Context,
    private val sessionManager: YmeSessionManager,
) {
    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val recentFingerprints = ConcurrentHashMap<String, Long>()

    fun track(
        eventType: String,
        text: String? = null,
        query: String? = null,
        conversationId: String? = null,
        contentId: String? = null,
        creatorId: String? = null,
        relatedUserId: String? = null,
        communityId: String? = null,
        postId: String? = null,
        messageId: String? = null,
        tags: List<String> = emptyList(),
        categories: List<String> = emptyList(),
        payload: Map<String, Any?> = emptyMap(),
        durationMs: Long? = null,
        watchTimeMs: Long? = null,
        scrollDurationMs: Long? = null,
        feedDwellMs: Long? = null,
        engagementValue: Double? = null,
        scrollSpeed: Double? = null,
        skipSpeed: Double? = null,
        rewatchCount: Int? = null,
        impressionId: String? = null,
        dedupeWindowMs: Long = 6_000L,
    ) {
        val userId = TokenManager.getUserId(appContext).orEmpty()
        if (userId.isBlank()) return

        val sessionId = sessionManager.touchSession()
        val fingerprint = buildFingerprint(
            userId = userId,
            eventType = eventType,
            conversationId = conversationId,
            contentId = contentId,
            postId = postId,
            messageId = messageId,
            text = text ?: query,
            impressionId = impressionId,
        )

        if (shouldSkip(fingerprint, dedupeWindowMs)) {
            return
        }

        val event = YmeEventPayload(
            userId = userId,
            eventType = eventType,
            sessionId = sessionId,
            clientEventId = UUID.randomUUID().toString(),
            conversationId = conversationId,
            contentId = contentId,
            creatorId = creatorId,
            relatedUserId = relatedUserId,
            communityId = communityId,
            postId = postId,
            messageId = messageId,
            text = text,
            query = query,
            tags = tags,
            categories = categories,
            payload = payload,
            durationMs = durationMs,
            watchTimeMs = watchTimeMs,
            scrollDurationMs = scrollDurationMs,
            feedDwellMs = feedDwellMs,
            engagementValue = engagementValue,
            scrollSpeed = scrollSpeed,
            skipSpeed = skipSpeed,
            rewatchCount = rewatchCount,
            impressionId = impressionId,
            appVersion = BuildConfig.VERSION_NAME,
            occurredAt = Instant.now().toString(),
        )

        scope.launch {
            val accepted = YmeEventQueue.enqueue(appContext, event, fingerprint)
            if (!accepted) {
                Log.d("YmeEventTracker", "Dropped client duplicate type=$eventType")
            }
        }
    }

    private fun shouldSkip(fingerprint: String, dedupeWindowMs: Long): Boolean {
        val now = System.currentTimeMillis()
        val lastSeenAt = recentFingerprints[fingerprint]
        if (lastSeenAt != null && now - lastSeenAt < dedupeWindowMs) {
            return true
        }
        recentFingerprints[fingerprint] = now
        val iterator = recentFingerprints.entries.iterator()
        while (iterator.hasNext()) {
            val entry = iterator.next()
            if (now - entry.value > 60_000L) {
                iterator.remove()
            }
        }
        return false
    }

    private fun buildFingerprint(
        userId: String,
        eventType: String,
        conversationId: String?,
        contentId: String?,
        postId: String?,
        messageId: String?,
        text: String?,
        impressionId: String?,
    ): String {
        val raw = listOf(
            userId,
            eventType,
            conversationId.orEmpty(),
            contentId.orEmpty(),
            postId.orEmpty(),
            messageId.orEmpty(),
            text.orEmpty().trim().lowercase().take(120),
            impressionId.orEmpty(),
        ).joinToString("|")
        val bytes = MessageDigest.getInstance("SHA-1").digest(raw.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
