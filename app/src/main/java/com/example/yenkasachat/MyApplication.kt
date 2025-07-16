package com.example.yenkasachat

import android.app.Application
import com.google.firebase.FirebaseApp
import com.onesignal.OneSignal

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // ✅ Initialize Firebase
        FirebaseApp.initializeApp(this)

        // ✅ OneSignal App ID (replace this with your actual OneSignal app ID)
        val ONESIGNAL_APP_ID = "your-onesignal-app-id"

        // ✅ Initialize OneSignal
        OneSignal.setLogLevel(OneSignal.LOG_LEVEL.VERBOSE, OneSignal.LOG_LEVEL.NONE)
        OneSignal.initWithContext(this)
        OneSignal.setAppId(ONESIGNAL_APP_ID)

        // ✅ Optional: Handle notification tap behavior
        OneSignal.setNotificationOpenedHandler { result ->
            val additionalData = result.notification.additionalData
            val messageBody = result.notification.body
            // You can log or act based on the data
            // For example: route to ChatActivity with extras
        }
    }
}
