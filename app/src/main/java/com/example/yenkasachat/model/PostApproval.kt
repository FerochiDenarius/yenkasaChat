package com.example.yenkasachat.model

data class PostApprovalItem(
    val _id: String,
    val post: String,
    val status: String,
    val submittedAt: String,
    val user: ApproverUser
)

data class ApproverUser(
    val username: String,
    val profileImage: String?
)

data class PostApprovalResponse(
    val pending: List<Post>
)

data class GenericResponse(
    val success: Boolean,
    val message: String
)

