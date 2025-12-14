package xyz.yenkasa.app.model

data class UnreadCountRequest(
    val userId: String,
    val roomId: String
)

data class UnreadCountData(
    val userId: String,
    val roomId: String,
    val count: Int,
    val updatedAt: String? = null,
    val lastReadTimestamp: String? = null
)

data class UnreadCountResponse(
    val success: Boolean,
    val data: UnreadCountData?,
    val error: String?
)

data class RoomUnreadCountResponse(
    val success: Boolean,
    val count: Int,
    val error: String?
)

data class RoomCount(
    val roomId: String,
    val count: Int
)

data class AllUnreadCountsResponse(
    val success: Boolean,
    val data: List<RoomCount>?,
    val totalUnread: Int?,
    val error: String?
)