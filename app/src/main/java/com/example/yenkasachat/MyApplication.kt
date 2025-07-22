package com.example.yenkasachat

import android.app.Application
import android.util.Log
import com.cloudinary.android.MediaManager
import com.example.yenkasachat.util.OneSignalHelper
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

        }

        // ✅ Handle when a notification is tapped
        OneSignal.setNotificationOpenedHandler { result: OSNotificationOpenedResult ->
            val notification = result.notification
            Log.d("OneSignal", "🔔 Opened: ${notification.body}, data: ${notification.additionalData}")
        }

        // ✅ Optionally log the player ID at startup
        val playerId = OneSignal.getDeviceState()?.userId
        Log.d("OneSignal", "🎯 Player ID at startup: $playerId")

        // ✅ Initialize Cloudinary
        val config = HashMap<String, String>().apply {
            put("cloud_name", "your_cloud_name") // replace this with your actual Cloudinary cloud name
            // Optional keys if you're using signed uploads:
            // put("api_key", "your_api_key")
            // put("api_secret", "your_api_secret")
        }
        try {
            MediaManager.init(this, config)
            Log.d("Cloudinary", "✅ Cloudinary initialized successfully")
        } catch (e: IllegalStateException) {
            Log.d("Cloudinary", "ℹ️ Cloudinary already initialized")
        } catch (e: Exception) {
            Log.e("Cloudinary", "❌ Cloudinary initialization failed: ${e.message}")
        }

    }
}
