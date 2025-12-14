package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

/**
 * Represents a single post approval queue entry
 */
data class PostApprovalItem(
    @SerializedName("_id")
    val _id: String,          // approvalId from PostApproval collection

    val post: Post,           // FULL Post object → matches your Post.kt model
    val user: UserBasic,      // Basic creator info
    val status: String        // "pending", "approved", "rejected"
)

/**
 * Response returned by GET /post-approval/pending
 */
data class PostApprovalResponse(
    val pending: List<PostApprovalItem>
)

/**
 * Generic backend response for approve/reject operations
 */
data class GenericResponse(
    val success: Boolean,
    val message: String
)
