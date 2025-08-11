package com.example.yenkasachat

import android.app.Application
import android.util.Log
import com.cloudinary.android.MediaManager
import com.example.yenkasachat.network.ApiClient
import com.google.firebase.FirebaseApp
import com.onesignal.OneSignal
import java.util.HashMap

class MyApplication : Application() {

    private val ONESIGNAL_APP_ID = "165df9e6-a0ea-4a37-a40a-110af7e28ad2"

    override fun onCreate() {
        super.onCreate()

        Log.d("MyApplication", "Application onCreate started.")

        // Initialize ApiClient
        ApiClient.init(this)
        Log.d("MyApplication", "ApiClient initialized")

        // Initialize Firebase
        FirebaseApp.initializeApp(this)
        Log.d("MyApplication", "FirebaseApp initialized")

        // ----------------------------------------------------------------------
        // ONE SIGNAL V4 INITIALIZATION
        // ----------------------------------------------------------------------

        // Enable verbose logging for debugging
        OneSignal.setLogLevel(OneSignal.LOG_LEVEL.VERBOSE, OneSignal.LOG_LEVEL.NONE)
        Log.d("MyApplication", "OneSignal LogLevel set to VERBOSE.")

        // Initialize OneSignal
        OneSignal.initWithContext(this)
        OneSignal.setAppId(ONESIGNAL_APP_ID)
        Log.d("MyApplication", "OneSignal initialized with App ID.")

        // Foreground notification handler
        OneSignal.setNotificationWillShowInForegroundHandler { notificationReceivedEvent ->
            val notification = notificationReceivedEvent.notification
            Log.d("OneSignal", "Notification Will Show: ${notification.notificationId}")
            Log.d("OneSignal", "Title: ${notification.title}")
            Log.d("OneSignal", "Body: ${notification.body}")
            // If you want to suppress it, call:
            // notificationReceivedEvent.complete(null)
        }

        // Notification opened handler
        OneSignal.setNotificationOpenedHandler { result ->
            val notification = result.notification
            Log.d("OneSignal", "Notification Clicked: ${notification.notificationId}")
            // Add your navigation or custom action logic here
        }

        // Get Player ID
        val oneSignalUserId = OneSignal.getDeviceState()?.userId
        if (oneSignalUserId != null) {
            Log.d("OneSignal", "Initial OneSignal Player ID (v4): $oneSignalUserId")
        } else {
            Log.d("OneSignal", "OneSignal Player ID not yet available.")
        }

        // ----------------------------------------------------------------------
        // END ONE SIGNAL V4 INITIALIZATION
        // ----------------------------------------------------------------------

        // Initialize Cloudinary
        val config: HashMap<String, String> = HashMap()
        config["cloud_name"] = "dwjj3zsaq"
        config["api_key"] = "548148892215273"
        config["api_secret"] = "d3L_8BGtqM30JgkRHy6SabmKnc0"
        MediaManager.init(this, config)
        Log.d("MyApplication", "MediaManager initialized.")

        Log.d("MyApplication", "Application onCreate finished.")
    }
}
