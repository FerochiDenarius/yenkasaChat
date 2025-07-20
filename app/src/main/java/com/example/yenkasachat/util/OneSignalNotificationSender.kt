package com.example.yenkasachat.util

import okhttp3.MediaType.Companion.toMediaTypeOrNull
import android.util.Log
import okhttp3.*
import org.json.JSONObject
import java.io.IOException
import org.json.JSONArray


object OneSignalNotificationSender {

    private const val ONESIGNAL_APP_ID = "165df9e6-a0ea-4a37-a40a-110af7e28ad2"
    private const val REST_API_KEY = "os_v2_app_czo7tzva5jfdpjakcefppyuk2kfg5qu74gsed34rhjwskilsxsk43baomvtcp2wdtejrduitjubldd5atnpoakyb6hcwv6h5ncnmxmi"

    fun sendNotification(receiverPlayerId: String, title: String, message: String) {
        val url = "https://onesignal.com/api/v1/notifications"

        val jsonBody = JSONObject().apply {
            put("app_id", ONESIGNAL_APP_ID)
            put("include_player_ids", JSONArray().put(receiverPlayerId))
            put("headings", JSONObject().put("en", title))
            put("contents", JSONObject().put("en", message))
        }

        val body = RequestBody.create("application/json; charset=utf-8".toMediaTypeOrNull(), jsonBody.toString())

        val request = Request.Builder()
            .url(url)
            .addHeader("Authorization", "Basic $REST_API_KEY")
            .post(body)
            .build()

        OkHttpClient().newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("OneSignalSend", "❌ Failed to send notification: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                if (response.isSuccessful) {
                    Log.d("OneSignalSend", "✅ Notification sent successfully")
                } else {
                    Log.e("OneSignalSend", "❌ Error sending notification: ${response.code} ${response.message}")
                }
            }
        })
    }
}
