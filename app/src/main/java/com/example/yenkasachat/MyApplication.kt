package com.example.yenkasachat

import android.app.Application
import android.util.Log
import com.example.yenkasachat.utils.OneSignalHelper
import com.onesignal.OSNotificationOpenedResult
import com.onesignal.OneSignal

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // ✅ Setup OneSignal logs for debugging
        OneSignal.setLogLevel(OneSignal.LOG_LEVEL.VERBOSE, OneSignal.LOG_LEVEL.NONE)

        // ✅ Initialize OneSignal via helper
        OneSignalHelper.initialize(this) {
            // 🔄 After OneSignal is ready, update player ID to backend
            OneSignalHelper.getPlayerIdAndUpdateToBackend(this)
        }

        // ✅ Handle when a notification is tapped
        OneSignal.setNotificationOpenedHandler { result: OSNotificationOpenedResult ->
            val notification = result.notification
            Log.d("OneSignal", "🔔 Opened: ${notification.body}, data: ${notification.additionalData}")
        }

        // ✅ Optionally log the player ID at startup
        val playerId = OneSignal.getDeviceState()?.userId
        Log.d("OneSignal", "🎯 Player ID at startup: $playerId")
    }
}
