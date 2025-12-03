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

class TotalMetricsFragment : MetricListFragment() {

    private var followersCount: Int = 0
    private var followingCount: Int = 0

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

        // Load initial UI immediately
        refreshMetricsUI()

        // Load REAL followers/following from backend
        loadFollowStats()
    }

    /**
     * 🔥 Fetch real-time follower/following stats (same as AccountInfoActivity)
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

                        // Update metrics now that we have live data
                        refreshMetricsUI()
                    }
                }

                override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                    Log.e("TotalMetrics", "Failed to load follow stats: ${t.message}")
                }
            })
    }

    /**
     * 🔥 Build UI metrics including REAL social stats
     */
    private fun refreshMetricsUI() {
        val d = dashboard ?: return
        val m = d.appVerification.currentMetrics

        val list = listOf(

            // RECEIVED METRICS
            Triple(R.drawable.ic_eye, "${m.totalViewsReceived}", "Views received"),
            Triple(R.drawable.ic_heart, "${m.totalLikesReceived}", "Likes received"),
            Triple(R.drawable.ic_comment, "${m.totalCommentsReceived}", "Comments received"),
            Triple(R.drawable.ic_reply, "${m.totalRepliesReceived}", "Replies received"),
            Triple(R.drawable.ic_like_comment, "${m.commentLikesReceived}", "Comment likes received"),
            Triple(R.drawable.ic_share, "${m.totalShares}", "Shares received"),

            // USER ACTIVITY METRICS
            Triple(R.drawable.ic_file, "${m.postsCreated}", "Posts created"),
            Triple(R.drawable.ic_eye, "${m.totalViewsCount}", "Views made"),
            Triple(R.drawable.ic_like, "${m.totalLikesCount}", "Likes made"),
            Triple(R.drawable.ic_comment_edit, "${m.totalCommentsMade}", "Comments made"),
            Triple(R.drawable.ic_file, "${m.totalPostCount}", "Total posts"),

            // SOCIAL METRICS (REAL DATA)
            Triple(R.drawable.ic_people, "$followersCount", "Followers"),
            Triple(R.drawable.ic_people, "$followingCount", "Following"),

            // VERIFICATION CORE METRICS
            Triple(R.drawable.ic_calendar, "${m.accountAge}", "Account age"),
            Triple(R.drawable.ic_login, "${m.dailyLogins}", "Daily logins"),
            Triple(R.drawable.ic_ads, "${m.adsViewed}", "Ads watched"),
            Triple(R.drawable.ic_like, "${m.maxLikesOnPost}", "Max likes on post")
        )

        applyMetrics(list)
    }
}
