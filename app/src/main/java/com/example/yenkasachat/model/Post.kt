package com.example.yenkasachat.model

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
    val videoUrl: String? = null,
    val audioUrl: String? = null,
    val mentions: List<String>? = null,

    // Engagement
    val likes: List<String> = emptyList(),
    val likeCount: Int = 0,
    val commentCount: Int = 0,
    val comments: List<Comment>? = null,
    val shareCount: Int = 0,
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
    var likedByCurrentUser: Boolean = false
) {

    companion object {
        fun fromJson(json: JSONObject): Post {
            return Post(
                _id = json.optString("_id"),
                caption = json.optString("text", json.optString("caption", null)),
                imageUrl = json.optString("imageUrl", null),
                videoUrl = json.optString("videoUrl", null),
                audioUrl = json.optString("audioUrl", null),
                mentions = json.optJSONArray("mentions")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }
                },
                likeCount = json.optInt("likeCount", 0),
                commentCount = json.optInt("commentCount", 0),
                shareCount = json.optInt("shareCount", 0),
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
                likedByCurrentUser = json.optBoolean("likedByCurrentUser", false),
                userId = UserBasic.fromJson(json.optJSONObject("userId")),
                communityId = CommunityBasic.fromJson(json.optJSONObject("communityId"))
            )
        }
    }
}
