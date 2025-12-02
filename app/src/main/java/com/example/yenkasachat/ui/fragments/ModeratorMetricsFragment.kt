package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.google.gson.Gson

class ModeratorMetricsFragment : MetricListFragment() {

    companion object {
        fun newInstance(data: VerificationDashboard): ModeratorMetricsFragment {
            val f = ModeratorMetricsFragment()
            val b = Bundle()
            val json = Gson().toJson(data)
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        setBadge(R.drawable.badge_moderator)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        val list = listOf(
            // ACTIVITY
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_comment_edit, "${m.totalCommentsMade}", "Comments made"),
            Triple(R.drawable.ic_eye, "${m.totalViewsCount}", "Views made"),
            Triple(R.drawable.ic_like, "${m.totalLikesCount}", "Likes made"),

            // SOCIAL
            Triple(R.drawable.ic_people, "${m.totalFollowers}", "Followers"),
            Triple(R.drawable.ic_people, "${m.totalFollowing}", "Following"),

            // VERIFICATION
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on post"),
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads viewed"),

            // EXTRA
            Triple(R.drawable.ic_file, "${m.totalPostCount}", "Total posts")
        )

        applyMetrics(list)
    }
}
