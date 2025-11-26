package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Role(
    @SerializedName("_id")
    val _id: String? = null,

    @SerializedName("role")
    val name: String? = null,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("roleName")
    val roleName: String? = null,


    @SerializedName("permissions")
    val permissions: Permission? = null
)



// ✅ Permissions model (matches backend fields)
data class Permission(
    @SerializedName("name")
    val name: String,

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("canPost")
    val canPost: Boolean = false,

    @SerializedName("canApprovePost")
    val canApprovePost: Boolean = false,

    @SerializedName("canSuspendUser")
    val canSuspendUser: Boolean = false,

    @SerializedName("canAssignRoles")
    val canAssignRoles: Boolean = false,

    @SerializedName("canRevokeAdmin")
    val canRevokeAdmin: Boolean = false
)
