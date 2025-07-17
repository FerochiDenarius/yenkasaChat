package com.example.yenkasachat.network

import android.util.Log
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object PlayerIdService {

    fun updatePlayerId(userId: String, playerId: String) {
        val body = mapOf("playerId" to playerId)

        // ✅ Use the correct reference
        val call = ApiClient.authService.updatePlayerId(userId, body)

        call.enqueue(object : Callback<Void> {
            override fun onResponse(call: Call<Void>, response: Response<Void>) {
                if (response.isSuccessful) {
                    Log.d("PlayerIdService", "✅ Player ID updated successfully.")
                } else {
                    Log.e("PlayerIdService", "❌ Failed to update Player ID. Code: ${response.code()}")
                }
            }

            override fun onFailure(call: Call<Void>, t: Throwable) {
                Log.e("PlayerIdService", "❌ Error updating Player ID: ${t.localizedMessage}")
            }
        })
    }
}
