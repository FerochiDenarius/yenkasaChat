package com.example.yenkasachat.util

import android.content.Context
import android.util.Log
import com.example.yenkasachat.network.ApiClient
import com.onesignal.OneSignal
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
// Make sure TokenManager is correctly imported if it's in a different package
// For example: import com.example.yenkasachat.util.TokenManager

object OneSignalHelper {
    private const val TAG = "OneSignalHelper"

    /**
     * Retrieves the OneSignal Player ID and sends it to the backend.
     * This method is for OneSignal SDK version 4.x (e.g., 4.8.6).
     */
    // ✅ Function name changed to match LoginActivity call
    fun getPlayerIdAndUpdateToBackend(context: Context) {
        try {
            // Get the Player ID using v4 API
            // ✅ Variable name changed for clarity (this holds the Player ID)
            val playerId = OneSignal.getDeviceState()?.userId
            val token = TokenManager.getToken(context)

            if (playerId.isNullOrEmpty()) { // ✅ Using the new variable name
                Log.e(TAG, "❌ OneSignal Player ID is null or empty.")
                return
            }

            if (token.isNullOrEmpty()) {
                Log.e(TAG, "❌ Token is null or empty. Cannot update Player ID.")
                // Potentially you might still want to proceed if the goal is only to get the Player ID
                // but for updating to backend, token is usually needed.
                return
            }

            val userId = TokenManager.getUserId(context)
            if (userId.isNullOrEmpty()) {
                Log.e(TAG, "❌ App User ID is missing, cannot update OneSignal Player ID to backend.")
                return
            }

            Log.d(TAG, "📨 Sending OneSignal Player ID: $playerId to backend for app User ID: $userId")

            // The key "playerId" is what your backend endpoint expects in the map.
            val requestBody = mapOf("playerId" to playerId)

            ApiClient.apiService.updatePlayerId(userId, requestBody).enqueue(object : Callback<ResponseBody> {
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                    if (response.isSuccessful) {
                        Log.d(TAG, "✅ OneSignal Player ID updated successfully on backend for app User ID: $userId")
                    } else {
                        Log.e(TAG, "❌ Failed to update OneSignal Player ID on backend. Code: ${response.code()} - Error: ${response.errorBody()?.string()} for app User ID: $userId")
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    Log.e(TAG, "❌ Network error while updating OneSignal Player ID to backend for app User ID: $userId. Error: ${t.message}", t)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ Exception in getPlayerIdAndUpdateToBackend: ${e.message}", e)
        }
    }
}
