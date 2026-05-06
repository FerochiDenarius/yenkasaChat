package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName
import org.json.JSONObject

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
    val createdAt: String,
    val updatedAt: String? = null,

    // Client-side UI state
    @SerializedName("likedByUser")
    var likedByUser: Boolean = false
) {
    fun effectiveImageUrls(): List<String> {
        return imageUrls.orEmpty()
            .filter { it.isNotBlank() }
            .ifEmpty { imageUrl?.takeIf { it.isNotBlank() }?.let { listOf(it) } ?: emptyList() }
    }

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
                    json.optInt("commentsCount", json.optInt("totalComments", 0))
                ),
                shareCount = json.optInt("shareCount", 0),
                saveCount = json.optInt("saveCount", 0),
                viewCount = json.optInt("viewCount", 0),
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
                createdAt = json.optString("createdAt"),
                updatedAt = json.optString("updatedAt", null),
                likedByUser = json.optBoolean("likedByUser", json.optBoolean("likedByCurrentUser", false)),
                userId = UserBasic.fromJson(json.optJSONObject("userId")),
                communityId = CommunityBasic.fromJson(json.optJSONObject("communityId"))
            )
        }
    }
}
