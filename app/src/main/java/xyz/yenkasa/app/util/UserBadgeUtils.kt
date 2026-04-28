package xyz.yenkasa.app.util

import android.view.View
import android.widget.ImageView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Role

object UserBadgeUtils {

    fun applyBadge(
        badgeView: ImageView,
        verified: Boolean,
        roleName: String?,
        role: Role? = null
    ) {
        val badgeRes = badgeRes(verified, roleName, role)
        if (badgeRes == null) {
            badgeView.visibility = View.GONE
        } else {
            badgeView.setImageResource(badgeRes)
            badgeView.visibility = View.VISIBLE
        }
    }

    fun shouldShowBadge(verified: Boolean, roleName: String?, role: Role? = null): Boolean {
        return badgeRes(verified, roleName, role) != null
    }

    private fun badgeRes(verified: Boolean, roleName: String?, role: Role?): Int? {
        return when (normalizedRole(roleName, role)) {
            "admin" -> R.drawable.badge_admin
            "senior_developer", "developer" -> R.drawable.senior_developer_banner
            "junior_developer" -> R.drawable.junior_developer_banner
            "moderator" -> R.drawable.badge_moderator
            "legend" -> R.drawable.badge_admin
            "rising_star", "verified" -> R.drawable.ic_verified
            else -> null
        }
    }

    private fun normalizedRole(roleName: String?, role: Role?): String {
        return listOf(roleName, role?.roleName, role?.name)
            .firstOrNull { !it.isNullOrBlank() }
            ?.trim()
            ?.lowercase()
            ?.replace(" ", "_")
            ?: "user"
    }
}
