package com.example.yenkasachat

import android.app.Application
import android.util.Log
import com.onesignal.OneSignal
import com.onesignal.OSNotificationOpenedResult

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // ✅ Initialize OneSignal
        OneSignal.setLogLevel(OneSignal.LOG_LEVEL.VERBOSE, OneSignal.LOG_LEVEL.NONE)
        OneSignal.initWithContext(this)
        OneSignal.setAppId("165df9e6-a0ea-4a37-a40a-110af7e28ad2")

        // ✅ Handle notification open action
        OneSignal.setNotificationOpenedHandler { result: OSNotificationOpenedResult ->
            val notification = result.notification
            Log.d("OneSignal", "Opened: ${notification.body}, data: ${notification.additionalData}")
        }

        // ✅ Optionally log the player ID (for testing)
        val deviceState = OneSignal.getDeviceState()
        val playerId = deviceState?.userId
        Log.d("OneSignal", "Player ID: $playerId")


        // ✅ Save global context if needed
        // AppContext.context = applicationContext
    }
}
