package com.example.yenkasachat.util

import android.content.Context
import android.util.Log
import com.example.yenkasachat.network.ApiClient
import com.onesignal.OneSignal // <-- Import OneSignal
import okhttp3.ResponseBody
import org.json.JSONObject // <-- Import for results from setExternalUserId
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object OneSignalHelper {
    private const val TAG = "OneSignalHelper"

    /**
     * Sets the External User ID for the current OneSignal user/device.
     * This is crucial for targeting specific users from your backend via OneSignal.
     * It should be called AFTER a user logs in and their app-specific User ID is known.
     *
     * @param context Context (used for updatePlayerIdToBackend call)
     * @param appUserId The application-specific User ID. Must not be null or empty.
     */
    fun setOneSignalExternalUserId(context: Context, appUserId: String) {
        Log.i(TAG, "setOneSignalExternalUserId called with App User ID: $appUserId") // Log entry

        if (appUserId.isNullOrEmpty()) {
            Log.e(TAG, "❌ App User ID is null or empty. Cannot set OneSignal External User ID. Aborting.")
            return
        }

        Log.i(TAG, "🚀 Attempting to set OneSignal External User ID: '$appUserId'")
        OneSignal.setExternalUserId(appUserId, object : OneSignal.OSExternalUserIdUpdateCompletionHandler {
            override fun onSuccess(results: JSONObject) {
                // External user ID successfully set on OneSignal servers
                Log.i(TAG, "✅ OneSignal External User ID '$appUserId' updated successfully. Results: $results")

                // Optionally, if you haven't done it elsewhere, you might now want to ensure
                // the current OneSignal Player ID is sent to your backend.
                // This is useful if the Player ID might have changed or was not available at login.
                val currentOneSignalPlayerId = OneSignal.getDeviceState()?.userId
                if (!currentOneSignalPlayerId.isNullOrEmpty()) {
                    Log.i(TAG, "🔄 Triggering backend update for Player ID '$currentOneSignalPlayerId' after successful External User ID set for '$appUserId'.")
                    updatePlayerIdToBackend(context, currentOneSignalPlayerId)
                } else {
                    Log.w(TAG, "⚠️ OneSignal Player ID is currently null after setting External User ID for '$appUserId'. Cannot update backend with Player ID right now.")
                }
            }

            override fun onFailure(error: OneSignal.ExternalIdError) {
                // Failed to set external user ID
                Log.e(TAG, "❌ Failed to set OneSignal External User ID '$appUserId'. Error Type: ${error.type}, Message: ${error.message}")
            }
        })
    }

    /**
     * Removes the External User ID for the current OneSignal user/device.
     * This should be called when a user logs out.
     */
    fun removeOneSignalExternalUserId() { // Context might not be needed if not calling other methods from here
        Log.i(TAG, "removeOneSignalExternalUserId called.") // Log entry

        Log.i(TAG, "🚀 Attempting to remove OneSignal External User ID.")
        OneSignal.removeExternalUserId(object : OneSignal.OSExternalUserIdUpdateCompletionHandler {
            override fun onSuccess(results: JSONObject) {
                Log.i(TAG, "✅ OneSignal External User ID removed successfully. Results: $results")
            }

            override fun onFailure(error: OneSignal.ExternalIdError) {
                Log.e(TAG, "❌ Failed to remove OneSignal External User ID. Error Type: ${error.type}, Message: ${error.message}")
            }
        })
    }


    /**
     * Sends a given OneSignal Player ID to your application's backend.
     * The Player ID should be obtained reliably before calling this.
     *
     * @param context Context for TokenManager and ApiClient
     * @param playerIdToSend The OneSignal Player ID to send to the backend. Must not be null or empty.
     */
    fun updatePlayerIdToBackend(context: Context, playerIdToSend: String) {
        Log.i(TAG, "updatePlayerIdToBackend called with Player ID: $playerIdToSend") // Log entry

        if (playerIdToSend.isNullOrEmpty()) {
            Log.e(TAG, "❌ Player ID to send is null or empty. Aborting backend update.")
            return
        }

        try {
            val token = TokenManager.getToken(context)
            // Logged the token status already, good.
            if (token.isNullOrEmpty()) {
                Log.w(TAG, "⚠️ Auth Token is null or empty. Backend update for Player ID '$playerIdToSend' might fail or is not expected if user is logged out.")
                // Proceeding, as this function might be called during logout after token is cleared,
                // but the appUserId check below is the more critical gate for a typical update.
            }

            val appUserIdForBackend = TokenManager.getUserId(context) // App's internal User ID
            if (appUserIdForBackend.isNullOrEmpty()) {
                Log.e(TAG, "❌ App User ID for backend is missing. Cannot associate OneSignal Player ID '$playerIdToSend' on backend. Aborting.")
                return // Critical for backend update
            }

            Log.i(TAG, "📨 Preparing to send OneSignal Player ID: '$playerIdToSend' to backend for App User ID: '$appUserIdForBackend'")

            val requestBody = mapOf("playerId" to playerIdToSend)
            Log.d(TAG, "Request body for Player ID update: $requestBody") // Log the body

            ApiClient.apiService.updatePlayerId(appUserIdForBackend, requestBody).enqueue(object : Callback<ResponseBody> {
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                    if (response.isSuccessful) {
                        Log.i(TAG, "✅ OneSignal Player ID ('$playerIdToSend') update SUCCESSFUL on backend for App User ID: '$appUserIdForBackend'. Code: ${response.code()}")
                    } else {
                        val errorBodyString = response.errorBody()?.string() ?: "N/A"
                        Log.e(TAG, "❌ Failed to update OneSignal Player ID ('$playerIdToSend') on backend for App User ID: '$appUserIdForBackend'. Code: ${response.code()}, Message: ${response.message()}, ErrorBody: $errorBodyString")
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    Log.e(TAG, "❌ NETWORK ERROR while updating OneSignal Player ID ('$playerIdToSend') to backend for App User ID: '$appUserIdForBackend'. Error: ${t.message}", t)
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "❌ EXCEPTION in updatePlayerIdToBackend for Player ID '$playerIdToSend'. Message: ${e.message}", e)
        }
    }
}
