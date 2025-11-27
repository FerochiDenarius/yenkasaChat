package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.NotificationAdapter
import com.example.yenkasachat.model.NotificationModel
import com.example.yenkasachat.network.ApiClient
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
                    }
                }

                override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                    Toast.makeText(this@UserNotificationsActivity, "Failed to load", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun markAsRead(id: String) {
        ApiClient.apiService.markNotificationRead(id)
            .enqueue(object : Callback<com.example.yenkasachat.model.ApiResponse> {
                override fun onResponse(
                    call: Call<com.example.yenkasachat.model.ApiResponse>,
                    response: Response<com.example.yenkasachat.model.ApiResponse>
                ) {}

                override fun onFailure(call: Call<com.example.yenkasachat.model.ApiResponse>, t: Throwable) {}
            })
    }
}
