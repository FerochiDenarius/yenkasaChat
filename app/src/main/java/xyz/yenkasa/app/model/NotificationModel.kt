package xyz.yenkasa.app.model

data class NotificationModel(
    val id: String,
    val type: String,
    val senderId: String?,
    val receiverId: String?,
    val message: String?,
    val title: String? = null,
    val subtitle: String? = null,
    val postId: String?,
    val commentId: String? = null,
    val activityId: String?,
    val status: String, // "unread" or "read"
    val createdAt: String?,
    val readAt: String?,
    val targetType: String?,
    val targetId: String?,
    val targetUrl: String?,
    val sender: Sender? = null,
    val thumbnailUrl: String? = null,
    val mediaType: String? = null,
    val pinned: Boolean = false,
    val badge: String? = null,
    val channelName: String? = null,
    val verifiedBadge: Boolean = false,
    val reactionFireCount: Int = 0,
    val reactionHeartCount: Int = 0,
<<<<<<< HEAD
    val reactionClapCount: Int = 0,
    val likesCount: Int = 0,
    val viewsCount: Int = 0
=======
    val reactionClapCount: Int = 0
>>>>>>> 5c23bfa7d (Introducing Yenkasa Live)
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
    val rewardEnabled: Boolean = true,
    val communityPostEnabled: Boolean = true
)

data class NotificationPreferencesResponse(
    val success: Boolean = true,
    val preferences: NotificationPreferences = NotificationPreferences()
)

data class UpdateNotificationPreferencesRequest(
    val inAppEnabled: Boolean? = null,
    val rewardEnabled: Boolean? = null,
    val communityPostEnabled: Boolean? = null
)
