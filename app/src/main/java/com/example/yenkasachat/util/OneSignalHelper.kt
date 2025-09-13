package com.example.yenkasachat.util

import android.content.Context
import android.util.Log
import com.example.yenkasachat.network.ApiClient // Ensure this provides your authenticated API service
import com.onesignal.OneSignal
import okhttp3.ResponseBody
import org.json.JSONObject
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
        Log.i(TAG, "setOneSignalExternalUserId called with App User ID: '$appUserId'") // Good log

        if (appUserId.isNullOrEmpty()) {
            Log.e(TAG, "❌ App User ID is null or empty. Cannot set OneSignal External User ID. Aborting.")
            return
        }

        Log.i(TAG, "🚀 Attempting to set OneSignal External User ID on OneSignal servers: '$appUserId'")
        OneSignal.setExternalUserId(appUserId, object : OneSignal.OSExternalUserIdUpdateCompletionHandler {
            override fun onSuccess(results: JSONObject) {
                Log.i(TAG, "✅ OneSignal External User ID '$appUserId' was successfully set on OneSignal servers. Results: $results")

                // Existing logic to then update backend is good.
                val currentOneSignalPlayerId = OneSignal.getDeviceState()?.userId
                if (!currentOneSignalPlayerId.isNullOrEmpty()) {
                    Log.i(TAG, "🔄 Triggering backend update for Player ID '$currentOneSignalPlayerId' associated with External User ID '$appUserId'.")
                    updatePlayerIdToBackend(context, currentOneSignalPlayerId) // Pass context
                } else {
                    Log.w(TAG, "⚠️ OneSignal Player ID is currently null after setting External User ID for '$appUserId'. Cannot trigger backend Player ID update right now.")
                }
            }

            override fun onFailure(error: OneSignal.ExternalIdError) {
                Log.e(TAG, "❌ Failed to set OneSignal External User ID '$appUserId' on OneSignal servers. Error Type: ${error.type}, Message: ${error.message}")
            }
        })
    }

    /**
     * Removes the External User ID for the current OneSignal user/device.
     * This should be called when a user logs out.
     */
    fun removeOneSignalExternalUserId() {
        Log.i(TAG, "removeOneSignalExternalUserId called.") // Good log

        Log.i(TAG, "🚀 Attempting to remove OneSignal External User ID from OneSignal servers.")
        OneSignal.removeExternalUserId(object : OneSignal.OSExternalUserIdUpdateCompletionHandler {
            override fun onSuccess(results: JSONObject) {
                Log.i(TAG, "✅ OneSignal External User ID removed successfully from OneSignal servers. Results: $results")
            }

            override fun onFailure(error: OneSignal.ExternalIdError) {
                Log.e(TAG, "❌ Failed to remove OneSignal External User ID from OneSignal servers. Error Type: ${error.type}, Message: ${error.message}")
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
    fun updatePlayerIdToBackend(context: Context, playerIdToSend: String?) { // Made playerIdToSend nullable to handle potential null from getDeviceState more gracefully
        Log.i(TAG, "updatePlayerIdToBackend invoked. Attempting to send Player ID: '$playerIdToSend' to backend.")

        if (playerIdToSend.isNullOrEmpty()) {
            Log.e(TAG, "❌ Player ID to send is null or empty. Aborting backend update for Player ID.")
            return
        }

        val appUserIdForBackend = TokenManager.getUserId(context)
        if (appUserIdForBackend.isNullOrEmpty()) {
            Log.e(TAG, "❌ App User ID for backend is missing. Cannot associate OneSignal Player ID '$playerIdToSend' on backend. Aborting.")
            return // Critical: Backend needs to know which user this Player ID belongs to.
        }

        val token = TokenManager.getToken(context)
        if (token.isNullOrEmpty()) {
            // This is a warning because sometimes this might be called during logout after token is cleared,
            // but for associating a Player ID with a logged-in user, the token is essential.
            Log.w(TAG, "⚠️ Auth Token is null or empty. Backend update for Player ID '$playerIdToSend' for App User ID '$appUserIdForBackend' will likely fail authentication.")
            // Depending on your backend, you might want to return here if token is mandatory for this endpoint.
            // For now, proceeding as your original code did, but this is a key failure point if token is required.
            // return // Uncomment if your backend STRICTLY requires an auth token for this call.
        }

        Log.i(TAG, "📨 Preparing to send OneSignal Player ID: '$playerIdToSend' to backend for App User ID: '$appUserIdForBackend'. Using Auth Token: ${if (token.isNullOrEmpty()) "MISSING" else "PRESENT"}")

        val requestBody = mapOf("playerId" to playerIdToSend) // Ensure your backend expects "playerId"
        Log.d(TAG, "Request body for Player ID update: $requestBody")

        // Ensure ApiClient.apiService.updatePlayerId is correctly defined:
        // - Does it take appUserId as a path parameter or in the body?
        // - Does it take an Auth header if your backend requires it?
        // - What is the expected request body structure? (Here, mapOf("playerId" to playerIdToSend))
        // - What is the expected response type? (Here, ResponseBody)

        // Assuming ApiClient.apiService.updatePlayerId expects appUserId (e.g., as a path param) and a body.
        // If it also needs the token as a header, it should be added in an Interceptor or directly here.
        // For simplicity, let's assume your ApiClient handles token injection if needed,
        // or your endpoint for updatePlayerId might not be protected by the same auth.
        // However, it's more secure if it is.

        // TODO: Verify how your ApiClient.apiService.updatePlayerId handles authentication (e.g., Auth token).
        // If it requires a token in the header, and it's not handled by an interceptor, you'd add it here:
        // e.g., ApiClient.apiService.updatePlayerId("Bearer $token", appUserIdForBackend, requestBody)

        ApiClient.apiService.updatePlayerId(appUserIdForBackend, requestBody) // Adjust this call based on your ApiService definition
            .enqueue(object : Callback<ResponseBody> {
                override fun onResponse(call: Call<ResponseBody>, response: Response<ResponseBody>) {
                    if (response.isSuccessful) {
                        Log.i(TAG, "✅ Backend update SUCCESSFUL for Player ID ('$playerIdToSend') for App User ID: '$appUserIdForBackend'. Code: ${response.code()}, Response: ${response.body()?.string()}")
                    } else {
                        val errorBodyString = try { response.errorBody()?.string() } catch (e: Exception) { "Error reading error body: ${e.message}" } ?: "N/A"
                        Log.e(TAG, "❌ Backend update FAILED for Player ID ('$playerIdToSend') for App User ID: '$appUserIdForBackend'. Code: ${response.code()}, Message: ${response.message()}, ErrorBody: $errorBodyString")
                    }
                }

                override fun onFailure(call: Call<ResponseBody>, t: Throwable) {
                    Log.e(TAG, "❌ NETWORK ERROR while updating Player ID ('$playerIdToSend') to backend for App User ID: '$appUserIdForBackend'. Error: ${t.message}", t)
                }
            })
    }
}
