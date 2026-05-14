package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class LiveStream(
    @SerializedName("_id")
    val id: String = "",
    val hostId: String = "",
    val hostUsername: String = "",
    val hostAvatar: String = "",
    val title: String = "",
    val thumbnail: String = "",
    val community: String = "",
    val agoraChannel: String = "",
    val isLive: Boolean = false,
    val lifecycleStatus: String = "",
    val hostConnected: Boolean = false,
    val viewerCount: Int = 0,
    val peakViewerCount: Int = 0,
    val hostRole: String = "",
    val maxDurationMinutes: Int? = null,
    val scheduledEndAt: String? = null,
    val hostJoinedAt: String? = null,
    val hostLastSeenAt: String? = null,
    val startupExpiresAt: String? = null,
    val startedAt: String? = null,
    val endedAt: String? = null
)

data class AgoraLiveToken(
    val appId: String = "",
    val token: String = "",
    val uid: Int = 0,
    val role: String = "audience",
    val expiresAt: Long = 0L
)

data class CreateLiveStreamRequest(
    val title: String,
    val community: String? = null,
    val thumbnail: String? = null
)

data class JoinLiveStreamRequest(
    val role: String = "audience"
)

data class LiveStreamResponse(
    val success: Boolean = false,
    val message: String? = null,
    val stream: LiveStream? = null,
    val agora: AgoraLiveToken? = null
)

data class LiveStreamsResponse(
    val success: Boolean = false,
    val message: String? = null,
    val streams: List<LiveStream> = emptyList()
)

data class LiveGiftRequest(
    val streamId: String,
    val giftKey: String
)

data class LiveGiftResponse(
    val success: Boolean = false,
    val message: String? = null,
    val balance: Double = 0.0,
    val ykcBalance: Double? = null,
    val coinsBalance: Double? = null
)
