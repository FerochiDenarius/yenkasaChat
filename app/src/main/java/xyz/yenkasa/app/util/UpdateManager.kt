package xyz.yenkasa.app.util

import android.app.Activity.RESULT_CANCELED
import android.app.Activity.RESULT_OK
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.pm.PackageInfoCompat
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.ActivityResult.RESULT_IN_APP_UPDATE_FAILED
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AppMinimumVersionResponse
import xyz.yenkasa.app.network.ApiClient
import java.util.concurrent.TimeUnit

class UpdateManager(private val activity: AppCompatActivity) {

    private val appUpdateManager: AppUpdateManager = AppUpdateManagerFactory.create(activity)
    private val prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private var activeFlexibleInfo: AppUpdateInfo? = null
    private var updateDialogShowing = false
    private var listenerRegistered = false

    private val installListener = InstallStateUpdatedListener { state ->
        logInstallState(state)

        when (state.installStatus()) {
            InstallStatus.DOWNLOADING -> showDownloadProgress(state)
            InstallStatus.DOWNLOADED -> showRestartSnackbar()
            InstallStatus.FAILED -> {
                Log.e(TAG, "Update install failed errorCode=${state.installErrorCode()}")
                Toast.makeText(activity, R.string.update_install_failed, Toast.LENGTH_LONG).show()
            }
            InstallStatus.CANCELED -> Log.w(TAG, "Update install canceled")
            else -> Unit
        }
    }

    fun checkForUpdates(forceCheck: Boolean = false, source: String = "startup") {
        if (!forceCheck && checkedRecently()) {
            Log.d(TAG, "Skipping update check; last check was recent. source=$source")
            completeUpdateIfDownloaded()
            return
        }
        rememberCheckTime()

        val currentVersion = currentVersionCode()
        Log.i(TAG, "Checking updates source=$source currentVersion=$currentVersion")

        ApiClient.apiService.getMinimumVersion().enqueue(object : Callback<AppMinimumVersionResponse> {
            override fun onResponse(
                call: Call<AppMinimumVersionResponse>,
                response: Response<AppMinimumVersionResponse>
            ) {
                val backend = if (response.isSuccessful) response.body() else null
                if (!response.isSuccessful) {
                    Log.w(TAG, "Minimum-version check failed http=${response.code()}")
                }
                checkPlayCoreUpdate(currentVersion, backend)
            }

            override fun onFailure(call: Call<AppMinimumVersionResponse>, t: Throwable) {
                Log.w(TAG, "Minimum-version check unavailable: ${t.message}", t)
                checkPlayCoreUpdate(currentVersion, null)
            }
        })
    }

    fun startFlexibleUpdate(appUpdateInfo: AppUpdateInfo? = activeFlexibleInfo) {
        val info = appUpdateInfo ?: run {
            Log.w(TAG, "Flexible update requested without AppUpdateInfo")
            Toast.makeText(activity, R.string.update_try_again_later, Toast.LENGTH_LONG).show()
            return
        }

        registerListener()
        showSnackbar(R.string.update_downloading, Snackbar.LENGTH_INDEFINITE)
        startPlayUpdate(info, AppUpdateType.FLEXIBLE)
    }

    fun startImmediateUpdate(appUpdateInfo: AppUpdateInfo) {
        startPlayUpdate(appUpdateInfo, AppUpdateType.IMMEDIATE)
    }

    fun completeUpdateIfDownloaded() {
        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                if (info.installStatus() == InstallStatus.DOWNLOADED) {
                    Log.i(TAG, "Downloaded update waiting for restart")
                    showRestartSnackbar()
                }
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "Unable to inspect downloaded update: ${error.message}", error)
            }
    }

    fun onActivityResult(requestCode: Int, resultCode: Int): Boolean {
        if (requestCode != UPDATE_REQUEST_CODE) return false

        when (resultCode) {
            RESULT_OK -> Log.i(TAG, "Update flow accepted by user")
            RESULT_CANCELED -> {
                Log.w(TAG, "Update flow canceled by user")
                Toast.makeText(activity, R.string.update_cancelled, Toast.LENGTH_LONG).show()
            }
            RESULT_IN_APP_UPDATE_FAILED -> {
                Log.e(TAG, "Update flow failed")
                Toast.makeText(activity, R.string.update_install_failed, Toast.LENGTH_LONG).show()
            }
            else -> Log.w(TAG, "Update flow finished with resultCode=$resultCode")
        }
        return true
    }

    fun destroy() {
        if (listenerRegistered) {
            appUpdateManager.unregisterListener(installListener)
            listenerRegistered = false
        }
    }

    private fun checkPlayCoreUpdate(
        currentVersion: Long,
        backend: AppMinimumVersionResponse?
    ) {
        val backendLatest = backend?.latestVersionCode ?: 0
        val backendMinimum = backend?.minimumVersionCode ?: 0
        val backendForce = backend?.forceUpdate == true &&
            backendLatest > 0 &&
            currentVersion < backendLatest
        val belowMinimum = backendMinimum > 0 && currentVersion < backendMinimum
        val backendRequiresImmediate = belowMinimum || backendForce
        val backendMessage = backend?.updateMessage?.takeIf { it.isNotBlank() }

        Log.i(
            TAG,
            "Backend update policy current=$currentVersion minimum=$backendMinimum latest=$backendLatest " +
                "force=${backend?.forceUpdate} immediate=$backendRequiresImmediate"
        )

        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { info ->
                val availableVersion = info.availableVersionCode()
                val priority = info.updatePriority()
                val stalenessDays = info.clientVersionStalenessDays()
                val updateAvailable = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                val immediateInProgress =
                    info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
                val shouldImmediate = backendRequiresImmediate || priority >= CRITICAL_PRIORITY

                Log.i(
                    TAG,
                    "Play update info availability=${info.updateAvailability()} current=$currentVersion " +
                        "available=$availableVersion priority=$priority stalenessDays=$stalenessDays " +
                        "immediate=$shouldImmediate"
                )

                if (immediateInProgress) {
                    startImmediateUpdate(info)
                    return@addOnSuccessListener
                }

                when {
                    shouldImmediate && updateAvailable && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> {
                        startImmediateUpdate(info)
                    }
                    shouldImmediate -> {
                        showRequiredPlayStoreDialog(backendMessage)
                    }
                    updateAvailable && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> {
                        activeFlexibleInfo = info
                        showFlexibleUpdateDialog(availableVersion, backendMessage)
                    }
                    backendLatest > currentVersion -> {
                        showFlexiblePlayStoreDialog(backendLatest, backendMessage)
                    }
                    else -> completeUpdateIfDownloaded()
                }
            }
            .addOnFailureListener { error ->
                Log.w(TAG, "Play Store update check failed: ${error.message}", error)
                if (backendRequiresImmediate) {
                    showRequiredPlayStoreDialog(backendMessage)
                }
            }
    }

    private fun showFlexibleUpdateDialog(availableVersion: Int, backendMessage: String?) {
        if (!shouldShowFlexiblePrompt(availableVersion.toLong()) || !canShowUi()) return
        updateDialogShowing = true

        MaterialAlertDialogBuilder(activity)
            .setTitle(R.string.update_dialog_title)
            .setMessage(backendMessage ?: activity.getString(R.string.update_dialog_message))
            .setPositiveButton(R.string.update_now) { _, _ ->
                updateDialogShowing = false
                startFlexibleUpdate()
            }
            .setNegativeButton(R.string.later) { _, _ ->
                updateDialogShowing = false
                rememberDismissal(availableVersion.toLong())
            }
            .setOnCancelListener {
                updateDialogShowing = false
                rememberDismissal(availableVersion.toLong())
            }
            .show()
    }

    private fun showFlexiblePlayStoreDialog(availableVersion: Long, backendMessage: String?) {
        if (!shouldShowFlexiblePrompt(availableVersion) || !canShowUi()) return
        updateDialogShowing = true

        MaterialAlertDialogBuilder(activity)
            .setTitle(R.string.update_dialog_title)
            .setMessage(backendMessage ?: activity.getString(R.string.update_dialog_message))
            .setPositiveButton(R.string.update_now) { _, _ ->
                updateDialogShowing = false
                openPlayStore()
            }
            .setNegativeButton(R.string.later) { _, _ ->
                updateDialogShowing = false
                rememberDismissal(availableVersion)
            }
            .setOnCancelListener {
                updateDialogShowing = false
                rememberDismissal(availableVersion)
            }
            .show()
    }

    private fun showRequiredPlayStoreDialog(backendMessage: String?) {
        if (!canShowUi()) return
        updateDialogShowing = true

        MaterialAlertDialogBuilder(activity)
            .setTitle(R.string.update_required_title)
            .setMessage(backendMessage ?: activity.getString(R.string.update_required_message))
            .setCancelable(false)
            .setPositiveButton(R.string.update_now) { _, _ ->
                updateDialogShowing = false
                openPlayStore()
            }
            .show()
    }

    private fun startPlayUpdate(info: AppUpdateInfo, updateType: Int) {
        try {
            Log.i(
                TAG,
                "Starting update type=${updateTypeName(updateType)} available=${info.availableVersionCode()} " +
                    "priority=${info.updatePriority()} staleness=${info.clientVersionStalenessDays()}"
            )
            appUpdateManager.startUpdateFlowForResult(
                info,
                updateType,
                activity,
                UPDATE_REQUEST_CODE
            )
        } catch (e: Exception) {
            Log.e(TAG, "Unable to start update flow: ${e.message}", e)
            Toast.makeText(activity, R.string.update_try_again_later, Toast.LENGTH_LONG).show()
        }
    }

    private fun showDownloadProgress(state: InstallState) {
        val total = state.totalBytesToDownload()
        val downloaded = state.bytesDownloaded()
        val percent = if (total > 0) ((downloaded * 100) / total).coerceIn(0, 100) else 0
        Log.d(TAG, "Downloading update bytes=$downloaded/$total percent=$percent")
        showSnackbar(activity.getString(R.string.update_downloading_with_percent, percent), Snackbar.LENGTH_SHORT)
    }

    private fun showRestartSnackbar() {
        if (!canShowUi()) return
        Snackbar.make(rootView(), R.string.update_ready_restart, Snackbar.LENGTH_INDEFINITE)
            .setAction(R.string.restart) {
                Log.i(TAG, "Completing downloaded update")
                appUpdateManager.completeUpdate()
            }
            .show()
    }

    private fun showSnackbar(textRes: Int, duration: Int) {
        if (!canShowUi()) return
        Snackbar.make(rootView(), textRes, duration).show()
    }

    private fun showSnackbar(text: String, duration: Int) {
        if (!canShowUi()) return
        Snackbar.make(rootView(), text, duration).show()
    }

    private fun openPlayStore() {
        val packageName = activity.packageName
        try {
            activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName")))
        } catch (e: ActivityNotFoundException) {
            activity.startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$packageName")
                )
            )
        }
    }

    private fun currentVersionCode(): Long {
        return try {
            val packageInfo = activity.packageManager.getPackageInfo(activity.packageName, 0)
            PackageInfoCompat.getLongVersionCode(packageInfo)
        } catch (e: Exception) {
            Log.w(TAG, "Unable to read versionCode: ${e.message}", e)
            0
        }
    }

    private fun checkedRecently(): Boolean {
        val lastCheck = prefs.getLong(KEY_LAST_CHECK_AT, 0)
        return System.currentTimeMillis() - lastCheck < CHECK_THROTTLE_MS
    }

    private fun rememberCheckTime() {
        prefs.edit().putLong(KEY_LAST_CHECK_AT, System.currentTimeMillis()).apply()
    }

    private fun shouldShowFlexiblePrompt(versionCode: Long): Boolean {
        if (updateDialogShowing) return false

        val dismissedVersion = prefs.getLong(KEY_DISMISSED_VERSION, -1)
        val dismissedAt = prefs.getLong(KEY_DISMISSED_AT, 0)
        val dismissedRecently = dismissedVersion == versionCode &&
            System.currentTimeMillis() - dismissedAt < FLEXIBLE_REMIND_AFTER_MS

        if (dismissedRecently) {
            Log.d(TAG, "Suppressing flexible update prompt for version=$versionCode")
        }
        return !dismissedRecently
    }

    private fun rememberDismissal(versionCode: Long) {
        prefs.edit()
            .putLong(KEY_DISMISSED_VERSION, versionCode)
            .putLong(KEY_DISMISSED_AT, System.currentTimeMillis())
            .apply()
    }

    private fun registerListener() {
        if (!listenerRegistered) {
            appUpdateManager.registerListener(installListener)
            listenerRegistered = true
        }
    }

    private fun logInstallState(state: InstallState) {
        Log.d(
            TAG,
            "Install state status=${state.installStatus()} bytes=${state.bytesDownloaded()}/" +
                "${state.totalBytesToDownload()} error=${state.installErrorCode()}"
        )
    }

    private fun rootView(): View = activity.findViewById(android.R.id.content)

    private fun canShowUi(): Boolean = !activity.isFinishing && !activity.isDestroyed

    private fun updateTypeName(type: Int): String {
        return when (type) {
            AppUpdateType.IMMEDIATE -> "IMMEDIATE"
            AppUpdateType.FLEXIBLE -> "FLEXIBLE"
            else -> "UNKNOWN"
        }
    }

    companion object {
        const val UPDATE_REQUEST_CODE = 4309
        private const val TAG = "UpdateManager"
        private const val PREFS_NAME = "yenkasa_update_prefs"
        private const val KEY_LAST_CHECK_AT = "last_check_at"
        private const val KEY_DISMISSED_AT = "last_dismissed_at"
        private const val KEY_DISMISSED_VERSION = "last_dismissed_version"
        private const val CRITICAL_PRIORITY = 4
        private val CHECK_THROTTLE_MS = TimeUnit.MINUTES.toMillis(30)
        private val FLEXIBLE_REMIND_AFTER_MS = TimeUnit.HOURS.toMillis(8)
    }
}
