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
            val json = Gson().toJson(data)   // ✅ FIX: JSON instead of Serializable
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        // ⭐ Verified badge
        setBadge(R.drawable.badge_verified)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        // ⭐ Your exact metrics
        val list = listOf(
            Triple(R.drawable.ic_eye, "${m.viewsReceived}", "Total views"),
            Triple(R.drawable.ic_heart, "${m.likesReceived}", "Total likes"),
            Triple(R.drawable.ic_comment, "${m.commentsReceived}", "Comments received"),
            Triple(R.drawable.ic_reply, "${m.repliesReceived}", "Replies received"),
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created")
        )

        applyMetrics(list)
    }
}
