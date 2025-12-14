package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class Comment(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("postId")
    val postId: String,

    // Keep as object from server
    @SerializedName("userId")
    val userId: CommentUser,

    @SerializedName("text")
    val text: String,

    @SerializedName("imageUrl")
    val imageUrl: String? = null,

    @SerializedName("likes")
    val likes: List<String> = emptyList(),

    @SerializedName("likeCount")
    val likeCount: Int = 0,

    @SerializedName("parentCommentId")
    val parentCommentId: String? = null,

    @SerializedName("replyCount")
    val replyCount: Int = 0,

    @SerializedName("isActive")
    val isActive: Boolean = true,

    @SerializedName("createdAt")
    val createdAt: String? = null,

    @SerializedName("updatedAt")
    val updatedAt: String? = null
) {
    // ✅ Custom getter for backward compatibility
    val user: CommentUser
        get() = userId

    // Helper property to easily check if comment is deleted
    val isDeleted: Boolean
        get() = !isActive
}

data class CommentUser(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("profileImage")
    val profileImage: String? = null,

    @SerializedName("verified")
    val verified: Boolean = false
)

data class RepliesResponse(
    val replies: List<Comment>,
    val pagination: Pagination
)

data class Pagination(
    val currentPage: Int,
    val totalPages: Int,
    val totalReplies: Int,
    val hasMore: Boolean
)

data class LikeResponse(
    val message: String,
    val likeCount: Int,
    val likedByUser: Boolean
)

data class CommentsResponse(
    val comments: List<Comment>,
    val pagination: Pagination
)