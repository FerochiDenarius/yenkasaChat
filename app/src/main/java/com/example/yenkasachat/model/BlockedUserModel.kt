package com.example.yenkasachat.model

data class BlockedUserModel(
    val userId: String,
    val username: String,
    val avatar: String? = null,
    val dateBlocked: String? = null
)

data class BlockUserRequest(
    val targetId: String
)

data class UnblockUserRequest(
    val targetId: String
)

data class BlockUserFromPostsRequest(
    val targetId: String
)
