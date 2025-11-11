package com.example.yenkasachat.util

object UserPermissions {

    private val rankOrder = listOf(
        "user",
        "verified",
        "admin",
        "moderator",
        "junior_developer",
        "senior_developer"
    )

    private fun normalize(role: String?): String =
        role?.trim()?.lowercase()?.replace(" ", "_") ?: "user"

    // 🟢 Can Post
    fun canPost(role: String?, verified: Boolean): Boolean {
        val r = normalize(role)
        return when (r) {
            "senior_developer", "junior_developer", "moderator", "admin", "verified" -> true
            else -> false
        }
    }

    // 🟢 Can Approve Posts
    fun canApprove(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator", "admin")
    }

    // 🟢 Can Create Communities
    fun canCreateCommunity(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator", "admin")
    }

    // 🟢 Can Assign Roles
    fun canAssignRoles(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator")
    }

    // 🟢 Can Revoke Permissions
    fun canRevoke(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator")
    }

    // 🟢 Can Suspend Users
    fun canSuspend(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator")
    }

    // 🟢 Check Rank Superiority
    fun canAffect(targetRole: String?, actingRole: String?): Boolean {
        val actor = normalize(actingRole)
        val target = normalize(targetRole)
        val actorRank = rankOrder.indexOf(actor)
        val targetRank = rankOrder.indexOf(target)
        return actorRank > targetRank
    }
}
