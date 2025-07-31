package com.example.yenkasachat.util

import android.content.Context
import android.util.Log
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import com.onesignal.OneSignal
import okhttp3.ResponseBody
import com.example.yenkasachat.util.TokenManager

object OneSignalHelper {
    private const val TAG = "OneSignalHelper"

    fun getPlayerIdAndUpdateToBackend(context: Context) {
        try {
            val deviceState = OneSignal.getDeviceState()
            val playerId = deviceState?.userId
            val token = TokenManager.getToken(context)

            if (playerId.isNullOrEmpty()) {
                Log.e(TAG, "❌ Player ID is null or empty")
                return
            }

            if (token.isNullOrEmpty()) {
                Log.e(TAG, "❌ Token is null or empty")
                return
            }

            val userId = TokenManager.getUserId(context)
            if (userId.isNullOrEmpty()) {
                Log.e(TAG, "❌ User ID is missing, cannot update playerId")
                return
            }

            Log.d(TAG, "📨 Sending OneSignal playerId: $playerId to backend for userId: $userId")

            val requestBody = mapOf("playerId" to playerId)

            ApiClient.apiService.updatePlayerId(userId, requestBody).enqueue(object : Callback<ResponseBody> {
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                    if (response.isSuccessful) {
                        Log.d(TAG, "✅ Player ID updated successfully on backend")
                    } else {
                        Log.e(TAG, "❌ Failed to update player ID: ${response.code()} - ${response.errorBody()?.string()}")
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    Log.e(TAG, "❌ Network error while updating player ID: ${t.message}")
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception while updating player ID: ${e.message}")
        }
    }
}
