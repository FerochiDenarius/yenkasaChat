package xyz.yenkasa.app.ui.player

import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.TextPostBackgrounds

data class YenkasaPlayerItem(
    val id: String,
    val mediaType: MediaType,
    val mediaUrl: String?,
    val imageUrls: List<String>,
    val thumbnailUrl: String?,
    val textContent: String?,
    val caption: String?,
    val username: String,
    val userAvatarUrl: String?,
    val isVerified: Boolean,
    val communityName: String?,
    val audioTitle: String?,
    val likeCount: Int,
    val viewCount: Int,
    val commentCount: Int,
    val shareCount: Int,
    val saveCount: Int,
    val rewardAmount: Int,
    val walletBalance: Double,
    val textBackgroundColor: String?,
    val textBackgroundImageUrl: String?,
    val userSelectedBackground: Boolean
) {
    companion object {
        fun fromPost(post: Post, walletBalance: Double): YenkasaPlayerItem {
            val imageUrls = post.effectiveImageUrls()
            val mediaType = when {
                !post.videoUrl.isNullOrBlank() -> MediaType.VIDEO
                !post.audioUrl.isNullOrBlank() -> MediaType.AUDIO
                imageUrls.isNotEmpty() -> MediaType.IMAGE
                else -> MediaType.TEXT
            }

            val normalizedBackground = TextPostBackgrounds.normalize(post.textBackgroundColor)
            val selectedBackground = normalizedBackground.isNotBlank() || !post.textBackgroundImageUrl.isNullOrBlank()

            return YenkasaPlayerItem(
                id = post._id,
                mediaType = mediaType,
                mediaUrl = when (mediaType) {
                    MediaType.VIDEO -> post.videoUrl
                    MediaType.AUDIO -> post.audioUrl
                    MediaType.IMAGE -> imageUrls.firstOrNull()
                    MediaType.TEXT -> null
                },
                imageUrls = imageUrls,
                thumbnailUrl = when {
                    imageUrls.isNotEmpty() -> imageUrls.firstOrNull()
                    !post.videoUrl.isNullOrBlank() -> post.videoUrl
                    else -> post.textBackgroundImageUrl
                },
                textContent = post.caption,
                caption = post.caption,
                username = post.userId.username,
                userAvatarUrl = post.userId.profileImage,
                isVerified = post.userId.verified,
                communityName = post.communityId?.displayName ?: post.communityId?.name,
                audioTitle = if (!post.audioUrl.isNullOrBlank()) "Original Sound - Yenkasa" else null,
                likeCount = post.likeCount,
                viewCount = post.viewCount,
                commentCount = post.resolvedCommentCount(),
                shareCount = post.shareCount,
                saveCount = post.saveCount,
                rewardAmount = post.coinsEarned,
                walletBalance = walletBalance,
                textBackgroundColor = normalizedBackground.ifBlank { null },
                textBackgroundImageUrl = post.textBackgroundImageUrl,
                userSelectedBackground = selectedBackground
            )
        }
    }
}
