package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class Announcement(
    @SerializedName("_id")
    val legacyId: String? = null,
    val id: String? = null,
    val title: String,
    val message: String,
    val authorId: String? = null,
    val authorUsername: String? = null,
    val authorRole: String? = null,
    val media: List<AnnouncementMedia> = emptyList(),
    val audience: String? = null,
    val communityId: String? = null,
    val communityName: String? = null,
    val status: String? = null,
    val scheduledAt: String? = null,
    val publishedAt: String? = null,
    val isPinned: Boolean = false,
    val isDeleted: Boolean = false,
    val viewsCount: Int = 0,
    val likesCount: Int = 0,
    val targetUrl: String? = null,
    val deepLinkUrl: String? = null,
    val previewText: String? = null,
    val primaryThumbnailUrl: String? = null,
    val primaryMediaType: String? = null,
    val badge: String? = null,
    val channelName: String? = null,
    val verifiedBadge: Boolean = true,
    val createdAt: String? = null,
    val updatedAt: String? = null
) {
    val stableId: String
        get() = id ?: legacyId.orEmpty()

    fun toNotificationModel(status: String = "unread"): NotificationModel {
        val preview = previewText?.takeIf { it.isNotBlank() } ?: message
        return NotificationModel(
            id = stableId,
            type = "announcement",
            senderId = authorId,
            receiverId = null,
            message = preview,
            title = title,
            subtitle = preview,
            postId = null,
            commentId = null,
            activityId = stableId,
            status = status,
            createdAt = createdAt,
            readAt = null,
            targetType = "announcement",
            targetId = stableId,
            targetUrl = targetUrl,
            sender = authorUsername?.let {
                Sender(
                    userId = authorId.orEmpty(),
                    username = it,
                    avatar = null,
                    roleName = authorRole
                )
            },
            thumbnailUrl = primaryThumbnailUrl,
            mediaType = primaryMediaType,
            pinned = isPinned,
            badge = badge,
            channelName = channelName,
            verifiedBadge = verifiedBadge,
            reactionFireCount = 0,
            reactionHeartCount = likesCount,
            reactionClapCount = 0,
            likesCount = likesCount,
            viewsCount = viewsCount
        )
    }
}

data class AnnouncementMedia(
    val type: String,
    val url: String,
    val thumbnail: String? = null,
    val filename: String? = null,
    val size: Long = 0L
)

data class AnnouncementResponse(
    val success: Boolean,
    val message: String? = null,
    val announcement: Announcement? = null
)

data class AnnouncementReactionResponse(
    val success: Boolean,
    val message: String? = null,
    val liked: Boolean = false,
    val likesCount: Int = 0,
    val viewsCount: Int = 0,
    val announcement: Announcement? = null
)
