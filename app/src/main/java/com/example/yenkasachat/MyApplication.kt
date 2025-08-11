package com.example.yenkasachat

import android.app.Application
import android.util.Log // Optional: for logging
import com.onesignal.OneSignal
import com.cloudinary.android.MediaManager
import com.example.yenkasachat.util.OneSignalHelper
import com.google.firebase.FirebaseApp
import com.example.yenkasachat.network.ApiClient // Make sure this import is correct

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // ✅ Initialize ApiClient FIRST if other initializations depend on it,
        // or just ensure it's done early.
        ApiClient.init(this) // <--- ADD THIS LINE
        Log.d("MyApplication", "ApiClient initialized") // Optional: for confirmation

        // ✅ Initialize Firebase
        FirebaseApp.initializeApp(this)

        // ✅ Initialize OneSignal
        OneSignal.initWithContext(this)
        OneSignal.setAppId("165df9e6-a0ea-4a37-a40a-110af7e28ad2")

        // ✅ Initialize Cloudinary
        val config: HashMap<String, String> = HashMap()
        config["cloud_name"] = "dwjj3zsaq"
        config["api_key"] = "548148892215273"
        config["api_secret"] = "d3L_8BGtqM30JgkRHy6SabmKnc0" // Ensure this secret is stored securely if this is a production app
        MediaManager.init(this, config)

        // ✅ Send playerId to backend
        // This might use ApiClient, so ensure ApiClient.init() is called before this.
        OneSignalHelper.getPlayerIdAndUpdateToBackend(this)
    }
}
