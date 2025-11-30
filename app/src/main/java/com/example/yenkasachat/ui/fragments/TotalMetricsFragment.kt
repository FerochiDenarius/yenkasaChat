package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.google.gson.Gson

class TotalMetricsFragment : MetricListFragment() {

    companion object {
        fun newInstance(data: VerificationDashboard): TotalMetricsFragment {
            val f = TotalMetricsFragment()
            val b = Bundle()
            val json = Gson().toJson(data)
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        // ⭐ TOTAL = ALL METRICS (universal icon set)
        val list = listOf(
            // PERFORMANCE
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_eye, "${m.totalViewsReceived}", "Total views"),
            Triple(R.drawable.ic_heart, "${m.totalLikesReceived}", "Likes received"),
            Triple(R.drawable.ic_comment, "${m.totalCommentsReceived}", "Comments received"),
            Triple(R.drawable.ic_reply, "${m.totalRepliesReceived}", "Replies received"),
            Triple(R.drawable.ic_like_comment, "${m.commentLikesReceived}", "Comment likes"),
            Triple(R.drawable.ic_share, "${m.totalShares}", "Shares"),

            // SOCIAL
            Triple(R.drawable.ic_people, "${m.totalFollowers}", "Followers"),
            Triple(R.drawable.ic_people, "${m.totalFollowing}", "Following"),

            // USER ACTIVITY
            Triple(R.drawable.ic_comment_edit, "${m.totalComments}", "Comments made"),
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on post"),
            Triple(R.drawable.ic_file, "${m.totalPostCount}", "Total post count"),
            Triple(R.drawable.ic_eye, "${m.totalViewsCount}", "Views count"),
            Triple(R.drawable.ic_comment_edit, "${m.totalCommentsMade}", "Comments made (alias)"),

            // VERIFICATION
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age (days)"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads viewed")
        )

        applyMetrics(list)
    }
}
