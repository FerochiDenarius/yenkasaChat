package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName


data class BlockedUserModel(
    @SerializedName("userId")
    val userId: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("profileImage")
    val avatar: String? = null,

    @SerializedName("roleName")
    val roleName: String? = null,   // 👈 direct from backend

    @SerializedName("role")
    val role: Role? = null,         // 👈 fallback if roleName missing

    @SerializedName("dateBlocked")
    val dateBlocked: String? = null
)


data class BlockUserRequest(
    val targetId: String
)

data class UnblockUserRequest(
    @SerializedName("blockedUserId")
    val targetId: String
)

data class BlockUserFromPostsRequest(
    val targetId: String
)
