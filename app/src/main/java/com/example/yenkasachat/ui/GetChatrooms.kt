package com.example.yenkasachat.ui

import android.content.Context
import android.util.Log
import com.example.yenkasachat.model.ChatRoomResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.SharedPrefs
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object GetChatrooms {

    fun fetchChatrooms(context: Context, onResult: (List<ChatRoomResponse>?) -> Unit) {
        val token = SharedPrefs.getToken(context)

        if (token.isNullOrEmpty()) {
            Log.e("ChatroomFetch", "No token found.")
            onResult(null)
            return
        }

        ApiClient.apiService.getChatrooms("Bearer $token")
            .enqueue(object : Callback<List<ChatRoomResponse>> {
                override fun onResponse(
                    call: Call<List<ChatRoomResponse>>,
                    response: Response<List<ChatRoomResponse>>
                ) {
                    if (response.isSuccessful) {
                        onResult(response.body())
                    } else {
                        Log.e("ChatroomFetch", "Unsuccessful: ${response.code()}")
                        onResult(null)
                    }
                }

                override fun onFailure(call: Call<List<ChatRoomResponse>>, t: Throwable) {
                    Log.e("ChatroomFetch", "Failure: ${t.message}")
                    onResult(null)
                }
            })
    }
}
