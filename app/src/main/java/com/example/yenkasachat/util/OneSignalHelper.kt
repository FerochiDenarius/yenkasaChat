package com.example.yenkasachat.util

import android.content.Context
import android.util.Log
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.utils.SharedPrefs
import com.onesignal.OneSignal
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object OneSignalHelper {

    private const val ONESIGNAL_APP_ID = "165df9e6-a0ea-4a37-a40a-110af7e28ad2"
    private const val TAG = "OneSignalHelper"

    fun initialize(context: Context, onReady: () -> Unit = {}) {
        OneSignal.initWithContext(context)
        OneSignal.setAppId(ONESIGNAL_APP_ID)
        Log.d(TAG, "✅ OneSignal initialized")

        // Wait and check for player ID after initialization
        val playerId = OneSignal.getDeviceState()?.userId
        if (!playerId.isNullOrEmpty()) {
            Log.d(TAG, "✅ OneSignal is ready with ID: $playerId")
            onReady()
        } else {
            Log.w(TAG, "⚠️ OneSignal user ID not available yet")
        }
    }

    fun getPlayerIdAndUpdateToBackend(context: Context) {
        try {
            val deviceState = OneSignal.getDeviceState()
            val playerId = deviceState?.userId
            val token = SharedPrefs.getToken(context)

            if (playerId.isNullOrEmpty()) {
                Log.e(TAG, "❌ Player ID is null or empty")
                return
            }

            if (token.isNullOrEmpty()) {
                Log.e(TAG, "❌ Token is null or empty")
                return
            }

            Log.d(TAG, "📨 Sending OneSignal playerId: $playerId to backend")

            val requestBody = mapOf("playerId" to playerId) // ✅ This matches backend

            ApiClient.apiService.updateOneSignalId("Bearer $token", requestBody)
                .enqueue(object : Callback<Void> {
                    override fun onResponse(call: Call<Void>, response: Response<Void>) {
                        if (response.isSuccessful) {
                            Log.d(TAG, "✅ OneSignal ID updated on backend")
                        } else {
                            Log.e(TAG, "❌ Failed to update OneSignal ID: ${response.code()}")
                        }
                    }

                    override fun onFailure(call: Call<Void>, t: Throwable) {
                        Log.e(TAG, "❌ Error updating OneSignal ID", t)
                    }
                })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception while retrieving OneSignal user ID", e)
        }
    }
}
