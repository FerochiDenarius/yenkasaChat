package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Permissions(

    @SerializedName("canPost")
    val canPost: Boolean = false,

    @SerializedName("canComment")
    val canComment: Boolean = false,

    @SerializedName("canCreateCommunity")
    val canCreateCommunity: Boolean = false,

    @SerializedName("canApprovePost")
    val canApprovePost: Boolean = false,

    @SerializedName("canRevokeAdmin")
    val canRevokeAdmin: Boolean = false,

    @SerializedName("canSuspendUser")
    val canSuspendUser: Boolean = false,

    @SerializedName("canAssignRoles")
    val canAssignRoles: Boolean = false
)
