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
            val json = Gson().toJson(data)   // ✅ FIX 1: use JSON instead of Serializable
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

        // ⭐ FIX 2: use ONLY existing drawables
        val list = listOf(
            Triple(R.drawable.ic_eye, "${m.totalFollowers}", "Total followers"),    // replaces ic_users
            Triple(R.drawable.ic_comment, "${m.commentsReceived}", "Comments received"),  // replaces ic_flag
            Triple(R.drawable.ic_heart, "${m.likesReceived}", "Likes received")     // replaces ic_like
        )

        applyMetrics(list)
    }
}
