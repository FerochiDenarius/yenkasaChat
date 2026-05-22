package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName
import org.json.JSONObject
import xyz.yenkasa.app.util.CloudinaryMedia

data class Post(
    @SerializedName("_id")
    val _id: String,

    val userId: UserBasic,
    val communityId: CommunityBasic? = null,

    // Content
    @SerializedName("text")
    val caption: String? = null,
    val imageUrl: String? = null,
    val imageUrls: List<String>? = emptyList(),
    val videoUrl: String? = null,
    val audioUrl: String? = null,
    val textBackgroundColor: String? = null,
    val textBackgroundImageUrl: String? = null,
    val mentions: List<String>? = null,

    // Engagement
    val likes: List<String> = emptyList(),
    val likeCount: Int = 0,
    @SerializedName(value = "commentCount", alternate = ["commentsCount", "totalComments"])
    val commentCount: Int = 0,
    val comments: List<Comment>? = null,
    @SerializedName(value = "shareCount", alternate = ["sharesCount", "totalShares"])
    val shareCount: Int = 0,
    val saveCount: Int = 0,
    @SerializedName(value = "viewCount", alternate = ["viewsCount", "totalViews"])
    var viewCount: Int = 0,

    // Status
    val isActive: Boolean = true,
    val isPinned: Boolean = false,
    val visibility: String = "public",

    @SerializedName("status")
    val status: String? = null,

    @SerializedName("isApproved")
    val isApproved: Boolean = false,

    // Tags & location
    val tags: List<String> = emptyList(),
    val location: String? = null,

    // Coins
    val coinsEarned: Int = 0,

    // Timestamps
    val createdAt: String = "",
    val updatedAt: String? = null,
    val eventId: String? = null,
    val requestId: String? = null,
    val clientRequestId: String? = null,
    val logicalPostKey: String? = null,
    val eventTimestamp: String? = null,

    // Client-side UI state
    @SerializedName("likedByUser")
    var likedByUser: Boolean = false
) {
    fun effectiveImageUrls(): List<String> {
        return imageUrls.orEmpty()
            .filter { it.isNotBlank() }
            .ifEmpty { imageUrl?.takeIf { it.isNotBlank() }?.let { listOf(it) } ?: emptyList() }
            .mapNotNull { CloudinaryMedia.optimizedImageUrl(it, CloudinaryMedia.WIDTH_FEED) }
    }

    fun optimizedVideoUrl(): String? =
        CloudinaryMedia.optimizedVideoUrl(videoUrl?.takeIf { it.isNotBlank() })

    fun optimizedAudioUrl(): String? =
        audioUrl?.takeIf { it.isNotBlank() }

    fun optimizedVideoPosterUrl(): String? =
        CloudinaryMedia.videoPosterUrl(videoUrl?.takeIf { it.isNotBlank() }, CloudinaryMedia.WIDTH_PREVIEW)

    fun resolvedCommentCount(): Int {
        return when {
            commentCount > 0 -> commentCount
            !comments.isNullOrEmpty() -> comments.size
            else -> 0
        }
    }

    companion object {
        fun fromJson(json: JSONObject): Post {
            val imageUrls = json.optJSONArray("imageUrls")?.let { arr ->
                List(arr.length()) { i -> arr.optString(i) }.filter { it.isNotBlank() }
            }.orEmpty()

            val eventTimestamp = cleanJsonString(json, "eventTimestamp")
            val createdAt = cleanJsonString(json, "createdAt")
                ?: cleanJsonString(json, "timestamp")
                ?: eventTimestamp
                ?: java.time.Instant.now().toString()

            return Post(
                _id = json.optString("_id"),
                caption = json.optString("text", json.optString("caption", null)),
                imageUrl = json.optString("imageUrl", null),
                imageUrls = imageUrls,
                videoUrl = json.optString("videoUrl", null),
                audioUrl = json.optString("audioUrl", null),
                textBackgroundColor = json.optString("textBackgroundColor", null),
                textBackgroundImageUrl = json.optString("textBackgroundImageUrl", null),
                mentions = json.optJSONArray("mentions")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }
                },
                likeCount = json.optInt("likeCount", 0),
                commentCount = json.optInt(
                    "commentCount",
                    json.optInt(
                        "commentsCount",
                        json.optInt(
                            "totalComments",
                            json.optJSONArray("comments")?.length() ?: 0
                        )
                    )
                ),
                shareCount = json.optInt("shareCount", 0),
                saveCount = json.optInt("saveCount", 0),
                viewCount = json.optInt(
                    "viewCount",
                    json.optInt("viewsCount", json.optInt("totalViews", 0))
                ),
                coinsEarned = json.optInt("coinsEarned", 0),
                isActive = json.optBoolean("isActive", true),
                isPinned = json.optBoolean("isPinned", false),
                visibility = json.optString("visibility", "public"),
                status = json.optString("status", null),
                isApproved = json.optBoolean("isApproved", false),
                tags = json.optJSONArray("tags")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }
                } ?: emptyList(),
                location = json.optString("location", null),
                createdAt = createdAt,
                updatedAt = cleanJsonString(json, "updatedAt"),
                eventId = cleanJsonString(json, "eventId"),
                requestId = cleanJsonString(json, "requestId"),
                clientRequestId = cleanJsonString(json, "clientRequestId"),
                logicalPostKey = cleanJsonString(json, "logicalPostKey"),
                eventTimestamp = eventTimestamp,
                likedByUser = json.optBoolean("likedByUser", json.optBoolean("likedByCurrentUser", false)),
                userId = UserBasic.fromJson(json.optJSONObject("userId")),
                communityId = CommunityBasic.fromJson(json.optJSONObject("communityId"))
            )
        }

        private fun cleanJsonString(json: JSONObject, key: String): String? {
            if (!json.has(key) || json.isNull(key)) return null
            return json.optString(key).trim().takeIf {
                it.isNotBlank() && !it.equals("null", ignoreCase = true)
            }
        }
    }
}
