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
            val json = Gson().toJson(data)   // ✅ FIXED: Use JSON instead of Serializable
            b.putString("data", json)
            f.arguments = b
            return f
        }
    }

    override fun onResume() {
        super.onResume()

        // ⭐ Moderator Badge
        setBadge(R.drawable.badge_moderator)

        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        // ⭐ YOUR METRICS (fixed missing icon)
        val list = listOf(
            Triple(R.drawable.ic_reply, "${m.repliesReceived}", "Reply interactions"),   // FIXED (ic_flag → ic_reply)
            Triple(R.drawable.ic_comment, "${m.totalComments}", "Comments made"),
            Triple(R.drawable.ic_eye, "${m.viewsReceived}", "Total views")
        )

        applyMetrics(list)
    }
}
