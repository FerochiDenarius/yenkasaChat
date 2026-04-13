package xyz.yenkasa.app.model

import com.google.gson.JsonObject

data class CreatePostResponse(
    val success: Boolean = false,
    val message: String? = null,
    val post: JsonObject? = null,
    val postingAccess: PostingAccess? = null
)

data class PostingAccess(
    val verified: Boolean? = null,
    val privileged: Boolean? = null,
    val postWindowHours: Int? = null,
    val postingLimit: Int? = null,
    val postsUsed: Int? = null,
    val remainingPosts: Int? = null,
    val requiresReview: Boolean? = null
)
