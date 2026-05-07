package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class LiveMetricsResponse(
    @SerializedName("window")
    val window: String = "5m",
    @SerializedName("topCommenters")
    val topCommenters: LiveLeaderboardSection = LiveLeaderboardSection(),
    @SerializedName("topLikes")
    val topLikes: LiveLeaderboardSection = LiveLeaderboardSection(),
    @SerializedName("topViews")
    val topViews: LiveLeaderboardSection = LiveLeaderboardSection(),
    @SerializedName("topConnectors")
    val topConnectors: LiveLeaderboardSection = LiveLeaderboardSection(),
    @SerializedName("topYKC")
    val topYKC: LiveLeaderboardSection = LiveLeaderboardSection(),
    @SerializedName("activityFeed")
    val activityFeed: List<LiveActivityEvent> = emptyList(),
    @SerializedName("events")
    val events: List<String> = emptyList(),
    @SerializedName("duel")
    val duel: LiveDuelState? = null,
    @SerializedName("microReward")
    val microReward: LiveMicroReward? = null,
    @SerializedName("activeEvent")
    val activeEvent: LiveEventMode? = null,
    @SerializedName("conversationStreak")
    val conversationStreak: LiveConversationStreak? = null,
    @SerializedName("generatedAt")
    val generatedAt: String? = null
)

data class LiveLeaderboardSection(
    @SerializedName("title")
    val title: String = "",
    @SerializedName("metricKey")
    val metricKey: String = "",
    @SerializedName("action")
    val action: String = "",
    @SerializedName("leaders")
    val leaders: List<LiveLeaderboardEntry> = emptyList(),
    @SerializedName("currentUser")
    val currentUser: LiveLeaderboardEntry? = null,
    val highlightCurrentUser: Boolean = false
)

data class LiveLeaderboardEntry(
    @SerializedName("userId")
    val userId: String = "",
    @SerializedName("username")
    val username: String = "",
    @SerializedName("profileImage")
    val profileImage: String? = null,
    @SerializedName("count")
    val count: Int = 0,
    @SerializedName("rank")
    val rank: Int = 0,
    @SerializedName("isCurrentUser")
    val isCurrentUser: Boolean = false,
    @SerializedName("progressHint")
    val progressHint: String? = null,
    @SerializedName("liveTitle")
    val liveTitle: String? = null,
    @SerializedName("titleType")
    val titleType: String? = null
)

data class LiveActivityEvent(
    @SerializedName("id")
    val id: String = "",
    @SerializedName("type")
    val type: String = "",
    @SerializedName("text")
    val text: String = "",
    @SerializedName("createdAt")
    val createdAt: String? = null,
    @SerializedName("userId")
    val userId: String? = null,
    @SerializedName("profileImage")
    val profileImage: String? = null,
    @SerializedName("isCurrentUser")
    val isCurrentUser: Boolean = false
)

data class LiveDuelState(
    @SerializedName("duelId")
    val duelId: String = "",
    @SerializedName("metricType")
    val metricType: String = "",
    @SerializedName("status")
    val status: String = "",
    @SerializedName("opponentId")
    val opponentId: String? = null,
    @SerializedName("opponentName")
    val opponentName: String = "",
    @SerializedName("opponentImage")
    val opponentImage: String? = null,
    @SerializedName("yourScore")
    val yourScore: Int = 0,
    @SerializedName("opponentScore")
    val opponentScore: Int = 0,
    @SerializedName("startTime")
    val startTime: String? = null,
    @SerializedName("endTime")
    val endTime: String? = null,
    @SerializedName("winner")
    val winner: String? = null,
    @SerializedName("isCreator")
    val isCreator: Boolean = false,
    @SerializedName("canJoin")
    val canJoin: Boolean = false,
    @SerializedName("prizeYkc")
    val prizeYkc: Int = 0,
    @SerializedName("timeLeftSeconds")
    val timeLeftSeconds: Int = 0
)

data class LiveMicroReward(
    @SerializedName("rewardAmount")
    val rewardAmount: Int = 0,
    @SerializedName("nextRewardAt")
    val nextRewardAt: String? = null,
    @SerializedName("topCommenter")
    val topCommenter: LiveRewardLeader? = null,
    @SerializedName("topViewer")
    val topViewer: LiveRewardLeader? = null
)

data class LiveRewardLeader(
    @SerializedName("username")
    val username: String = "",
    @SerializedName("count")
    val count: Int = 0,
    @SerializedName("isCurrentUser")
    val isCurrentUser: Boolean = false
)

data class LiveEventMode(
    @SerializedName("name")
    val name: String = "",
    @SerializedName("duration")
    val duration: String = "",
    @SerializedName("bonusMultiplier")
    val bonusMultiplier: Double = 1.0
)

data class LiveConversationStreak(
    @SerializedName("days")
    val days: Int = 0,
    @SerializedName("activeConnections")
    val activeConnections: Int = 0,
    @SerializedName("message")
    val message: String = ""
)

data class LiveDuelEnvelope(
    @SerializedName("message")
    val message: String? = null,
    @SerializedName("duel")
    val duel: LiveDuelState? = null,
    @SerializedName("error")
    val error: String? = null
)

data class LiveRewardProcessResponse(
    @SerializedName("winners")
    val winners: List<LiveRewardWinner> = emptyList(),
    @SerializedName("rewardAmount")
    val rewardAmount: Int = 0
)

data class LiveRewardWinner(
    @SerializedName("userId")
    val userId: String = "",
    @SerializedName("username")
    val username: String = "",
    @SerializedName("metricType")
    val metricType: String = "",
    @SerializedName("metricLabel")
    val metricLabel: String = "",
    @SerializedName("rewardAmount")
    val rewardAmount: Int = 0
)

data class LiveEventResponse(
    @SerializedName("activeEvent")
    val activeEvent: LiveEventMode? = null
)
