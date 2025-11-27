package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.NotificationAdapter
import com.example.yenkasachat.model.NotificationModel
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.model.ApiResponse
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_notifications)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvNotifications)
        rv.layoutManager = LinearLayoutManager(this)

        // Pass click listener → mark as read
        adapter = NotificationAdapter(mutableListOf()) { item ->
            markAsRead(item.id)
        }

        rv.adapter = adapter

        loadNotifications()
    }

    private fun loadNotifications() {
        ApiClient.apiService.getNotifications()
            .enqueue(object : Callback<List<NotificationModel>> {

                override fun onResponse(
                    call: Call<List<NotificationModel>>,
                    res: Response<List<NotificationModel>>
                ) {
                    if (res.isSuccessful && res.body() != null) {
                        adapter.update(res.body()!!)
                    } else {
                        Toast.makeText(
                            this@UserNotificationsActivity,
                            "Failed to load notifications",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                    Toast.makeText(
                        this@UserNotificationsActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun markAsRead(id: String) {
        ApiClient.apiService.markNotificationRead(id)
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(
                    call: Call<ApiResponse>,
                    response: Response<ApiResponse>
                ) {
                    // No need to toast — silent update
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    // Silent fail
                }
            })
    }
}
