package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.google.gson.Gson

class AdminMetricsFragment : MetricListFragment() {

    companion object {
        fun newInstance(data: VerificationDashboard): AdminMetricsFragment {
            val f = AdminMetricsFragment()
            val b = Bundle()
            val json = Gson().toJson(data)
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        // ⭐ Admin badge
        setBadge(R.drawable.badge_admin)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        // ⭐ FULL METRICS LIST (ALL METRICS IN SYSTEM)
        val list = listOf(

            // -------------------------
            // PERFORMANCE METRICS
            // -------------------------
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_eye, "${m.totalViewsReceived}", "Total views"),
            Triple(R.drawable.ic_heart, "${m.totalLikesReceived}", "Post likes received"),
            Triple(R.drawable.ic_comment, "${m.totalCommentsReceived}", "Comments received"),
            Triple(R.drawable.ic_reply, "${m.totalRepliesReceived}", "Replies received"),
            Triple(R.drawable.ic_like_comment, "${m.commentLikesReceived}", "Comment likes"),
            Triple(R.drawable.ic_share, "${m.totalShares}", "Shares"),

            // -------------------------
            // VERIFICATION CORE METRICS
            // -------------------------
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age (days)"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads viewed"),

            // -------------------------
            // SOCIAL GRAPH
            // -------------------------
            Triple(R.drawable.ic_people, "${m.totalFollowers}", "Followers"),
            Triple(R.drawable.ic_people, "${m.totalFollowing}", "Following"),

            // -------------------------
            // USER ACTIVITY OUTPUT
            // -------------------------
            Triple(R.drawable.ic_comment_edit, "${m.totalComments}", "Comments made"),
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on any post"),

            // -------------------------
            // OPTIONAL / EXTRA METRICS
            // (exists in backend & safe to display)
            // -------------------------
            Triple(R.drawable.ic_file, "${m.totalPostCount}", "Total post count"),
            Triple(R.drawable.ic_eye, "${m.totalViewsCount}", "View count (alias)"),
            Triple(R.drawable.ic_comment, "${m.totalCommentsMade}", "Comments made (alias)")
        )

        applyMetrics(list)
    }
}
