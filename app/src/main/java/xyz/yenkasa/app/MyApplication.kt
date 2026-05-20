package xyz.yenkasa.app

import android.app.Application
import android.app.NotificationManager // Added
import android.os.Build // Added
import android.os.StrictMode
import android.util.Log
import com.cloudinary.android.MediaManager
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.OneSignalHelper // Make sure this import is correct
import com.google.firebase.FirebaseApp
import com.onesignal.OSSubscriptionObserver
import com.onesignal.OSSubscriptionStateChanges
import com.onesignal.OneSignal
import java.util.HashMap
import com.jakewharton.threetenabp.AndroidThreeTen
import androidx.core.app.NotificationCompat
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.RequestConfiguration
import org.json.JSONObject
import xyz.yenkasa.app.ui.CallNotificationHandler
import xyz.yenkasa.app.util.CallPayloadUtils
import xyz.yenkasa.app.util.ChatNotificationState
import xyz.yenkasa.app.util.LocaleManager
import xyz.yenkasa.app.util.NotificationNavigation
import xyz.yenkasa.app.util.NotificationSoundManager


class MyApplication : Application(), OSSubscriptionObserver {

    private val ONESIGNAL_APP_ID = "165df9e6-a0ea-4a37-a40a-110af7e28ad2" // Your OneSignal App ID
    private val ONE_SIGNAL_TAG = "OneSignalApp"

    companion object {
        private const val PREFS_NAME = "settings"
        private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        private const val KEY_REWARD_NOTIFICATIONS_ENABLED = "reward_notifications_enabled"
        private const val KEY_COMMUNITY_POST_NOTIFICATIONS_ENABLED = "community_post_notifications_enabled"
    }


    override fun onCreate() {
        super.onCreate()
        enableDebugStrictMode()
        LocaleManager.restoreSavedLocale(this)
        AndroidThreeTen.init(this)
        // Initialize Google Mobile Ads SDK
        if (BuildConfig.DEBUG) {
            MobileAds.setRequestConfiguration(
                RequestConfiguration.Builder()
                    .setTestDeviceIds(listOf("E78DC7AF6A5521AAF9BD602110FA0BCC"))
                    .build()
            )
        }
        MobileAds.initialize(this) { initializationStatus ->
            Log.d("Ads", "Google Mobile Ads initialized: $initializationStatus")
        }

        OneSignal.getDeviceState()?.let {
            Log.d(
                "MyApp",
                "Initial OneSignal state: userId=${it.userId}, isSubscribed=${it.isSubscribed}"
            )
        }
        Log.d("MyApplication", "Application onCreate started.")

        // Initialize ApiClient
        ApiClient.init(this)
        Log.d("MyApplication", "ApiClient initialized")


        // Initialize Firebase
        FirebaseApp.initializeApp(this)
        Log.d("MyApplication", "FirebaseApp initialized")

        // --- Create Notification Channels (For Android 8.0 Oreo and above) ---
        createNotificationChannels()
        CallNotificationHandler.ensureCallNotificationChannel(this)

        // --- ONE SIGNAL V4 INITIALIZATION ---
        Log.i(ONE_SIGNAL_TAG, "--- Starting OneSignal v4 Setup ---")
        // It's good practice to set the log level first.
        OneSignal.setLogLevel(OneSignal.LOG_LEVEL.VERBOSE, OneSignal.LOG_LEVEL.NONE)
        Log.d(ONE_SIGNAL_TAG, "OneSignal LogLevel set to VERBOSE.")

        // It's generally recommended to initialize OneSignal before adding observers or other handlers.
        // The SDK needs to be initialized to have a context to work with.
        OneSignal.initWithContext(this)
        OneSignal.setAppId(ONESIGNAL_APP_ID) // Make sure this is called after initWithContext
        Log.d(ONE_SIGNAL_TAG, "OneSignal initialized with context and App ID: $ONESIGNAL_APP_ID")



        OneSignal.addSubscriptionObserver(this)
        Log.d(ONE_SIGNAL_TAG, "OSSubscriptionObserver added.")


        OneSignal.setNotificationWillShowInForegroundHandler { event ->
            val notif = event.notification
            if (isCallNotification(notif.additionalData)) {
                event.complete(null)
                CallNotificationHandler.showIncomingCall(this, notif.additionalData ?: JSONObject())
                return@setNotificationWillShowInForegroundHandler
            }

            event.complete(null)

            if (isMutedNotification(notif.additionalData)) {
                Log.d(ONE_SIGNAL_TAG, "Notification muted by user preferences.")
                return@setNotificationWillShowInForegroundHandler
            }

            val data = notif.additionalData
            if (data?.optString("type") == "new_chat_message") {
                val roomId = firstNonBlank(
                    data.optString("roomId"),
                    data.optString("chatId"),
                    data.optString("targetId")
                )
                val senderId = data.optString("senderId")
                val messageId = data.optString("messageId")
                if (ChatNotificationState.shouldSuppressNotification(this, senderId, roomId, messageId)) {
                    Log.d(ONE_SIGNAL_TAG, "Chat notification suppressed: sender/current user, active room, or duplicate message.")
                    return@setNotificationWillShowInForegroundHandler
                }
            }

            val channelId = NotificationSoundManager.ensureMessageChannel(this)
            val soundUri = NotificationSoundManager.getSoundUri(this)

            val title = notif.title ?: "Notification"
            val body = notif.body ?: ""
            val contentIntent = NotificationNavigation.buildPendingIntent(this, notif.additionalData)

            // 🔔 Build our own custom notification with user-selected sound
            val builder = NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_bell)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setSound(soundUri)
                .setContentIntent(contentIntent)

            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(System.currentTimeMillis().toInt(), builder.build())
        }

        OneSignal.setNotificationOpenedHandler { result ->
            val notification = result.notification
            Log.i(ONE_SIGNAL_TAG, "Notification Clicked: ${notification.notificationId}, Title: ${notification.title}")
            if (isCallNotification(notification.additionalData)) {
                CallNotificationHandler.handleNotificationOpened(this, notification.additionalData ?: JSONObject())
                return@setNotificationOpenedHandler
            }
            startActivity(NotificationNavigation.buildIntent(this, notification.additionalData))
        }

        // Initial check for Player ID (as you have)
        // This relies on the device state being available synchronously, which might not always be the case
        // immediately after init. The OSSubscriptionObserver is more reliable for changes.
        val deviceState = OneSignal.getDeviceState()
        if (deviceState != null && deviceState.userId != null) {
            val initialPlayerId = deviceState.userId
            Log.i(ONE_SIGNAL_TAG, "Initial check in onCreate: OneSignal Player ID: $initialPlayerId. Subscribed: ${deviceState.isSubscribed}")
            // You are already saving it, which is good. Consider if you need to update backend here as well,
            // but onOSSubscriptionChanged is usually the primary place for that.
            TokenManager.saveOneSignalPlayerId(this, initialPlayerId)
            val authToken = TokenManager.getToken(this)
            val appUserId = TokenManager.getUserId(this)
            if (!authToken.isNullOrEmpty() && !appUserId.isNullOrEmpty()) {
                Log.i(ONE_SIGNAL_TAG, "User '$appUserId' is logged in during app start. Syncing Player ID to backend.")
                OneSignalHelper.updatePlayerIdToBackend(applicationContext, initialPlayerId)
            }
        } else {
            Log.w(ONE_SIGNAL_TAG, "Initial check in onCreate: OneSignal Player ID not yet available or device state is null. Waiting for OSSubscriptionObserver.")
        }
        OneSignalHelper.schedulePlayerIdSyncRetries(applicationContext, "application_start")
        Log.i(ONE_SIGNAL_TAG, "--- OneSignal v4 Setup Complete ---")
        // --- END ONE SIGNAL V4 INITIALIZATION ---

        // Initialize Cloudinary
        val config: HashMap<String, String> = HashMap()
        config["cloud_name"] = "dwjj3zsaq"
        config["api_key"] = "548148892215273"
        config["api_secret"] = "d3L_8BGtqM30JgkRHy6SabmKnc0"
        MediaManager.init(this, config)
        Log.d("MyApplication", "MediaManager initialized.")

        Log.d("MyApplication", "Application onCreate finished.")
    }

    private fun firstNonBlank(vararg values: String?): String? {
        return values.firstOrNull { !it.isNullOrBlank() }
    }

    private fun enableDebugStrictMode() {
        if (!BuildConfig.DEBUG) return

        StrictMode.setThreadPolicy(
            StrictMode.ThreadPolicy.Builder()
                .detectDiskReads()
                .detectDiskWrites()
                .detectNetwork()
                .detectCustomSlowCalls()
                .penaltyLog()
                .build()
        )
        StrictMode.setVmPolicy(
            StrictMode.VmPolicy.Builder()
                .detectLeakedClosableObjects()
                .detectActivityLeaks()
                .penaltyLog()
                .build()
        )
    }


    private fun createNotificationChannels() {
        NotificationSoundManager.ensureMessageChannel(this)
    }

    private fun isCallNotification(data: JSONObject?): Boolean {
        if (data == null) return false
        if (CallPayloadUtils.isDataCall(data)) return false
        val targetType = data.optString("targetType", "")
        val type = data.optString("type", "")
        return targetType.equals("call", ignoreCase = true) ||
            type.equals("call_invite", ignoreCase = true) ||
            type.equals("call_request", ignoreCase = true)
    }

    private fun isMutedNotification(data: JSONObject?): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val notificationsEnabled = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        val rewardNotificationsEnabled = prefs.getBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, true)
        val communityPostNotificationsEnabled = prefs.getBoolean(KEY_COMMUNITY_POST_NOTIFICATIONS_ENABLED, true)
        return !notificationsEnabled ||
            (isRewardNotification(data) && !rewardNotificationsEnabled) ||
            (isCommunityPostNotification(data) && !communityPostNotificationsEnabled)
    }

    private fun isRewardNotification(data: JSONObject?): Boolean {
        if (data == null) return false
        val type = data.optString("type", "").lowercase()
        val targetType = data.optString("targetType", "").lowercase()
        return type == "reward" || type.startsWith("reward_") || targetType == "wallet"
    }

    private fun isCommunityPostNotification(data: JSONObject?): Boolean {
        if (data == null) return false
        return data.optString("type", "").equals("community_post", ignoreCase = true) ||
            data.optString("notificationType", "").equals("community_post", ignoreCase = true)
    }

    override fun onOSSubscriptionChanged(stateChanges: OSSubscriptionStateChanges) {
        Log.i(ONE_SIGNAL_TAG, "--- OSSubscriptionState CHANGED ---")
        Log.d(ONE_SIGNAL_TAG, "FROM: subscribed=${stateChanges.from.isSubscribed}, pushToken=${stateChanges.from.pushToken}, userId=${stateChanges.from.userId}")
        Log.d(ONE_SIGNAL_TAG, "TO:   subscribed=${stateChanges.to.isSubscribed}, pushToken=${stateChanges.to.pushToken}, userId=${stateChanges.to.userId}")

        val newPlayerId = stateChanges.to.userId
        val oldPlayerId = stateChanges.from.userId // Can be null
        val isNowSubscribed = stateChanges.to.isSubscribed
        val wasSubscribed = stateChanges.from.isSubscribed

        if (isNowSubscribed) {
            if (newPlayerId != null) {
                // Log whether it's a new subscription, a change in player ID, or just a state update.
                when {
                    !wasSubscribed -> Log.i(ONE_SIGNAL_TAG, "User JUST SUBSCRIBED. New Player ID: $newPlayerId")
                    oldPlayerId != newPlayerId -> Log.i(ONE_SIGNAL_TAG, "Player ID CHANGED from $oldPlayerId to $newPlayerId")
                    else -> Log.i(ONE_SIGNAL_TAG, "Subscription state updated. Player ID $newPlayerId is current and subscribed.")
                }

                TokenManager.saveOneSignalPlayerId(this, newPlayerId)
                Log.i(ONE_SIGNAL_TAG, "Player ID '$newPlayerId' saved locally via TokenManager.")

                val authToken = TokenManager.getToken(this)
                val appUserId = TokenManager.getUserId(this) // This is YOUR app's user ID

                if (!authToken.isNullOrEmpty() && !appUserId.isNullOrEmpty()) {
                    Log.i(ONE_SIGNAL_TAG, "User '$appUserId' is logged in. Attempting to update backend with Player ID: '$newPlayerId'")
                    // THIS IS THE CRITICAL CALL
                    OneSignalHelper.updatePlayerIdToBackend(applicationContext, newPlayerId)
                } else {
                    Log.w(ONE_SIGNAL_TAG, "User not logged in (token or appUserId missing). Player ID '$newPlayerId' stored locally, will attempt backend update later if logic allows.")
                    // Consider if you have a mechanism to send this Player ID once the user logs in.
                }
            } else {
                // This case should be rare if isNowSubscribed is true, but good to log.
                Log.e(ONE_SIGNAL_TAG, "CRITICAL: User is subscribed according to OneSignal, but Player ID (userId) is NULL. This needs investigation with OneSignal support if it happens frequently.")
            }
        } else { // Not subscribed now
            if (wasSubscribed) {
                Log.w(ONE_SIGNAL_TAG, "User UNSUBSCRIBED. Previous Player ID was: $oldPlayerId")
                TokenManager.clearOneSignalPlayerId(this)
                Log.i(ONE_SIGNAL_TAG, "Local Player ID cleared.")
                // Optional: Notify backend to remove this Player ID if your backend needs to know.
                // OneSignalHelper.removePlayerIdFromBackend(applicationContext, oldPlayerId)
            } else {
                Log.d(ONE_SIGNAL_TAG, "User remains unsubscribed. No Player ID to process.")
            }
        }
        Log.i(ONE_SIGNAL_TAG, "--- Finished processing OSSubscriptionState change ---")
    }


}
