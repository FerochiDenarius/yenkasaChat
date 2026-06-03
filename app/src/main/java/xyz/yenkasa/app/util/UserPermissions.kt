package xyz.yenkasa.app.util

object UserPermissions {

    private val rankOrder = listOf(
        "unverified",
        "verified",
        "rising_star",
        "legend",
        "business_account",
        "premium_seller",
        "top_vendor",
        "brand_ambassador",
        "campus_influencer",
        "moderator",
        "staff",
        "support",
        "analyst",
        "admin",
        "junior_developer",
        "senior_developer"
    )

    private fun normalize(role: String?): String {
        val normalized = role?.trim()?.lowercase()?.replace(Regex("[\\s-]+"), "_") ?: "unverified"
        return when (normalized) {
            "user" -> "unverified"
            "developer" -> "senior_developer"
            "verified_creator" -> "verified"
            "senior_dev", "super_admin", "superadmin" -> "senior_developer"
            "junior_dev" -> "junior_developer"
            "moderator", "admin", "staff", "support", "analyst" -> normalized
            else -> normalized
        }
    }

    // 🟢 Can Post
    fun canPost(role: String?, verified: Boolean): Boolean {
        val r = normalize(role)
        return when (r) {
            "unverified" -> verified
            "verified", "rising_star", "legend", "business_account", "premium_seller",
            "top_vendor", "brand_ambassador", "campus_influencer", "admin", "moderator",
            "junior_developer", "senior_developer" -> true
            else -> false
        }
    }

    // 🟢 Can Approve Posts
    fun canApprove(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator", "admin")
    }

    fun canAccessAdminFeatures(role: String?): Boolean {
        return canAccessAnalytics(role) || canModerate(role) || canManageEconomy(role)
    }

    fun canAccessAnalytics(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "moderator", "admin")
    }

    fun canModerate(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf(
            "senior_developer",
            "junior_developer",
            "moderator",
            "admin"
        )
    }

    fun canManageEconomy(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "admin")
    }

    fun canMonitorFraud(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "moderator", "admin")
    }

    // 🟢 Can Create Communities
    fun canCreateCommunity(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf(
            "rising_star",
            "legend",
            "business_account",
            "premium_seller",
            "top_vendor",
            "brand_ambassador",
            "campus_influencer",
            "senior_developer",
            "junior_developer",
            "moderator",
            "admin"
        )
    }

    // 🟢 Can Create Sponsored Ads
    fun canCreateAd(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf(
            "verified",
            "rising_star",
            "legend",
            "business_account",
            "premium_seller",
            "top_vendor",
            "brand_ambassador",
            "campus_influencer",
            "admin",
            "moderator",
            "junior_developer",
            "senior_developer"
        )
    }

    // 🟢 Can Assign Roles
    fun canAssignRoles(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "admin")
    }

    // 🟢 Can Revoke Permissions
    fun canRevoke(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "admin")
    }

    // 🟢 Can Suspend Users
    fun canSuspend(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "junior_developer", "admin", "moderator")
    }

    fun canGenerateRoleCodes(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "admin")
    }

    fun canManageRoles(role: String?): Boolean {
        return canGenerateRoleCodes(role)
    }

    fun canPublishGlobalUpdates(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf("senior_developer", "admin")
    }

    fun canStartLivestream(role: String?): Boolean {
        val r = normalize(role)
        return r in listOf(
            "unverified",
            "verified",
            "rising_star",
            "legend",
            "business_account",
            "premium_seller",
            "top_vendor",
            "brand_ambassador",
            "campus_influencer",
            "senior_developer",
            "junior_developer",
            "admin",
            "moderator",
            "staff",
            "support",
            "analyst"
        )
    }

    fun canGenerateStaffRole(role: String?, targetRole: String?): Boolean {
        val actor = normalize(role)
        val target = normalize(targetRole)
        if (actor == "senior_developer") return target in listOf(
            "moderator",
            "admin",
            "junior_developer",
            "senior_developer"
        )
        return canAffect(target, actor)
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
