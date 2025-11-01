package com.example.yenkasachat.ui

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.example.yenkasachat.R

class FeedContainerFragment : Fragment() {

    private var isRefreshing = false
    private val refreshHandler = Handler(Looper.getMainLooper())
    private var refreshRunnable: Runnable? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        // Inflate FeedActivity layout directly for now
        return inflater.inflate(R.layout.activity_feed, container, false)
    }

    override fun onResume() {
        super.onResume()
        startFeedRefresh()
    }

    override fun onPause() {
        super.onPause()
        stopFeedRefresh()
    }

    private fun startFeedRefresh() {
        if (isRefreshing) {
            Log.d("FeedContainer", "⏳ Already refreshing, skipping new request")
            return
        }

        isRefreshing = true
        Log.d("FeedContainer", "🔄 Starting feed refresh loop (5s max)")

        // Simulate a refresh call to your feed loader (replace with real refresh)
        refreshRunnable = Runnable {
            stopFeedRefresh()
            Log.d("FeedContainer", "✅ Feed refresh completed or timed out.")
        }

        // Stop refresh after 5 seconds max
        refreshHandler.postDelayed(refreshRunnable!!, 5000)

        // If you have a FeedFragment or adapter loader, call it here
        refreshFeedData()
    }

    private fun stopFeedRefresh() {
        if (!isRefreshing) return
        isRefreshing = false

        refreshRunnable?.let { refreshHandler.removeCallbacks(it) }
        refreshRunnable = null

        Log.d("FeedContainer", "🛑 Feed refresh stopped.")
    }

    private fun refreshFeedData() {
        // Replace this with your real feed fetching logic.
        Log.d("FeedContainer", "📡 Fetching new feed data from API...")
        // Example: ApiClient.apiService.getFeed().enqueue(...)
    }
}
