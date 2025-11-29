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

        // set badge if desired; e.g., setBadge(R.drawable.ic_total_badge)
        // setBadge(R.drawable.ic_total_badge)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics
        val p = d.performanceMetrics

        val list = listOf(
            Triple(R.drawable.ic_eye, "${m.viewsReceived}", "Views received"),
            Triple(R.drawable.ic_heart, "${m.likesReceived}", "Total likes"),
            Triple(R.drawable.ic_comment, "${m.commentsReceived}", "Comments received"),
            Triple(R.drawable.ic_reply, "${m.repliesReceived}", "Replies received"),
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_share, "${m.totalShares}", "Post shares")
        )

        applyMetrics(list)
    }
}
