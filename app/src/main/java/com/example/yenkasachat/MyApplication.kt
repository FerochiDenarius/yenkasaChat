package com.example.yenkasachat

import android.app.Application
import com.onesignal.OneSignal
import com.cloudinary.android.MediaManager
import com.example.yenkasachat.util.OneSignalHelper

class MyApplication : Application() {

    override fun onCreate() {
        super.onCreate()

        // ✅ Initialize OneSignal
        OneSignal.initWithContext(this)
        OneSignal.setAppId("165df9e6-a0ea-4a37-a40a-110af7e28ad2")

        // ✅ Initialize Cloudinary
        val config: HashMap<String, String> = HashMap()
        config["cloud_name"] = "ddrsrydfh"
        config["api_key"] = "276843932118844"
        config["api_secret"] = "7K_WupMd31E5NPNYPfOaAdF_pqs"
        MediaManager.init(this, config)

        // ✅ Send playerId to backend
        OneSignalHelper.getPlayerIdAndUpdateToBackend(this)
    }
}
