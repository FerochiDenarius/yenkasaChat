package xyz.yenkasa.app.util

object UserPermissions {

    private val rankOrder = listOf(
        "unverified",
        "verified",
        "rising_star",
        "legend",
        "moderator",
        "junior_developer",
        "senior_developer",
        "admin"
    )

    private fun normalize(role: String?): String {
        val normalized = role?.trim()?.lowercase()?.replace(" ", "_") ?: "unverified"
        return when (normalized) {
            "user" -> "unverified"
            "developer" -> "senior_developer"
            "senior_dev", "senior-developer" -> "senior_developer"
            "moderator", "admin" -> normalized
            else -> normalized
        }
    }

    // 🟢 Can Post
    fun canPost(role: String?, verified: Boolean): Boolean {
        val r = normalize(role)
        return when (r) {
            "unverified" -> verified
            "verified", "rising_star", "legend", "admin", "moderator",
            "junior_developer", "senior_developer" -> true
            else -> false
        }
    }

    // 🟢 Can Approve Posts
    fun canApprove(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "moderator", "admin")
    }

    fun canAccessAdminFeatures(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "moderator", "admin")
    }

    // 🟢 Can Create Communities
    fun canCreateCommunity(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("rising_star", "legend", "senior_developer", "junior_developer", "moderator", "admin")
    }

    // 🟢 Can Create Sponsored Ads
    fun canCreateAd(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("verified", "rising_star", "legend", "admin", "moderator", "junior_developer", "senior_developer")
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
        if (actorRank == -1 || targetRank == -1) return false
        return actorRank > targetRank
    }
}
