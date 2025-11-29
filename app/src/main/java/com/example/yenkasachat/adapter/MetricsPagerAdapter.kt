package com.example.yenkasachat.adapter

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.example.yenkasachat.model.VerificationDashboard
import com.example.yenkasachat.ui.fragments.*

class MetricsPagerAdapter(
    activity: FragmentActivity,
    private val dashboard: VerificationDashboard
) : FragmentStateAdapter(activity) {

    override fun getItemCount() = 4

    override fun createFragment(position: Int): Fragment {
        return when (position) {
            0 -> VerifiedMetricsFragment.newInstance(dashboard)
            1 -> AdminMetricsFragment.newInstance(dashboard)
            2 -> ModeratorMetricsFragment.newInstance(dashboard)
            3 -> TotalMetricsFragment.newInstance(dashboard)
            else -> VerifiedMetricsFragment.newInstance(dashboard)
        }
    }
}
