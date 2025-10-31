package com.example.yenkasachat.util

object UserPermissions {
    fun canPost(role: String?, verified: Boolean): Boolean {
        return verified || role in listOf("admin", "moderator", "developer")
    }

    fun canApprove(role: String?): Boolean {
        return role in listOf("admin", "moderator", "developer")
    }

    fun canRevoke(role: String?): Boolean {
        return role in listOf("moderator", "developer")
    }

    fun canManageRoles(role: String?): Boolean {
        return role == "developer"
    }
}
