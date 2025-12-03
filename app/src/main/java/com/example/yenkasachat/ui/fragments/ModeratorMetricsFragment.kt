package com.example.yenkasachat.ui.fragments

import android.os.Bundle
import android.util.Log
import com.example.yenkasachat.R
import com.example.yenkasachat.model.VerificationDashboard
import com.example.yenkasachat.model.FollowResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.gson.Gson
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ModeratorMetricsFragment : MetricListFragment() {

    private var followersCount: Int = 0
    private var followingCount: Int = 0

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

        // Load initial UI using available verification metrics
        refreshMetricsUI()

        // Fetch REAL followers/following from server
        loadFollowStats()
    }

    /**
     * 🔥 Fetch real follower and following stats (same as AccountInfoActivity)
     */
    private fun loadFollowStats() {
        val ctx = requireContext()
        val token = TokenManager.getToken(ctx) ?: return
        val userId = TokenManager.getUserId(ctx) ?: return

        ApiClient.apiService.getFollowStats(userId, "Bearer $token")
            .enqueue(object : Callback<FollowResponse> {
                override fun onResponse(
                    call: Call<FollowResponse>,
                    response: Response<FollowResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val stats = response.body()!!

                        followersCount = stats.followersCount ?: 0
                        followingCount = stats.followingCount ?: 0

                        // Update UI now that real numbers are available
                        refreshMetricsUI()
                    }
                }

                override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                    Log.e("ModeratorMetrics", "Failed to load follow stats: ${t.message}")
                }
            })
    }

    /**
     * 🔥 Build metrics list using real social stats + verification stats
     */
    private fun refreshMetricsUI() {
        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        val list = listOf(
            // ACTIVITY
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_comment_edit, "${m.totalCommentsMade}", "Comments made"),
            Triple(R.drawable.ic_eye, "${m.totalViewsCount}", "Views made"),
            Triple(R.drawable.ic_like, "${m.totalLikesCount}", "Likes made"),

            // SOCIAL (REAL STATS)
            Triple(R.drawable.ic_people, "$followersCount", "Followers"),
            Triple(R.drawable.ic_people, "$followingCount", "Following"),

            // VERIFICATION METRICS
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on post"),
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads viewed"),

            // EXTRA COUNTS
            Triple(R.drawable.ic_file, "${m.totalPostCount}", "Total posts")
        )

        applyMetrics(list)
    }
}
