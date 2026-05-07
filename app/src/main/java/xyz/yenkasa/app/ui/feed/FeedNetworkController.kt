package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import android.widget.TextView
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import kotlinx.coroutines.launch
import xyz.yenkasa.app.work.FeedSyncWorker
import java.util.concurrent.TimeUnit

class FeedNetworkController(
    private val fragment: Fragment
) {
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    fun updateOfflineBanner(offlineBanner: TextView, isOffline: Boolean) {
        if (isOffline) {
            offlineBanner.text = "Offline Mode • Showing Saved Feed"
        }
        offlineBanner.visibility = if (isOffline) android.view.View.VISIBLE else android.view.View.GONE
    }

    fun isOnline(): Boolean {
        val manager = connectivityManager
            ?: fragment.requireContext().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = manager.activeNetwork ?: return false
            val capabilities = manager.getNetworkCapabilities(network) ?: return false
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        } else {
            @Suppress("DEPRECATION")
            manager.activeNetworkInfo?.isConnected == true
        }
    }

    fun setupNetworkMonitoring(
        offlineBanner: TextView,
        shouldReload: () -> Boolean,
        onReload: () -> Unit
    ) {
        connectivityManager =
            fragment.requireContext().getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val manager = connectivityManager ?: return
        updateOfflineBanner(offlineBanner, !isOnline())

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                fragment.viewLifecycleOwner.lifecycleScope.launch {
                    updateOfflineBanner(offlineBanner, false)
                    if (shouldReload()) onReload()
                }
            }

            override fun onLost(network: Network) {
                fragment.viewLifecycleOwner.lifecycleScope.launch {
                    updateOfflineBanner(offlineBanner, !isOnline())
                }
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        runCatching { manager.registerNetworkCallback(request, networkCallback!!) }
    }

    fun scheduleBackgroundFeedSync() {
        val workRequest = PeriodicWorkRequestBuilder<FeedSyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(fragment.requireContext().applicationContext)
            .enqueueUniquePeriodicWork("feed_sync", ExistingPeriodicWorkPolicy.KEEP, workRequest)
    }

    fun tearDown() {
        connectivityManager?.let { manager ->
            networkCallback?.let { callback ->
                runCatching { manager.unregisterNetworkCallback(callback) }
            }
        }
        networkCallback = null
        connectivityManager = null
    }
}
