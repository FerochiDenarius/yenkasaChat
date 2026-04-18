package xyz.yenkasa.app.model

data class NotificationModel(
    val id: String,
    val type: String,
    val senderId: String?,
    val receiverId: String?,
    val message: String?,
    val postId: String?,
    val activityId: String?,
    val status: String, // "unread" or "read"
    val createdAt: String?,
    val readAt: String?,
    val targetType: String?,
    val targetId: String?,
    val targetUrl: String?,
    val sender: Sender? = null
)

data class Sender(
    val userId: String,
    val username: String,
    val avatar: String?,
    val roleName: String?
)


data class NotificationSound(
    val id: String,
    val title: String,
    val rawResId: Int
)

data class NotificationPreferences(
    val inAppEnabled: Boolean = true,
    val rewardEnabled: Boolean = true
)

data class NotificationPreferencesResponse(
    val success: Boolean = true,
    val preferences: NotificationPreferences = NotificationPreferences()
)

data class UpdateNotificationPreferencesRequest(
    val inAppEnabled: Boolean? = null,
    val rewardEnabled: Boolean? = null
)
