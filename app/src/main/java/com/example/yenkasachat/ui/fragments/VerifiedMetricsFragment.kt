package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.google.gson.Gson

class VerifiedMetricsFragment : MetricListFragment() {

    companion object {
        fun newInstance(data: VerificationDashboard): VerifiedMetricsFragment {
            val f = VerifiedMetricsFragment()
            val b = Bundle()
            val json = Gson().toJson(data)
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        setBadge(R.drawable.badge_verified)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        val list = listOf(
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_comment_edit, "${m.totalComments}", "Comments made"),
            Triple(R.drawable.ic_people, "${m.totalFollowers}", "Followers"),
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on post"),

            // Verification core
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads viewed")
        )

        applyMetrics(list)
    }
}
