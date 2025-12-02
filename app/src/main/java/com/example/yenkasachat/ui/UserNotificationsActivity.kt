package com.example.yenkasachat.ui

import android.app.NotificationManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.MyApplication
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.NotificationAdapter
import com.example.yenkasachat.model.ApiResponse
import com.example.yenkasachat.model.NotificationModel
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.SimpleDateFormat
import java.util.*

class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter
    private var previousList: List<NotificationModel> = emptyList()

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
                    if (!res.isSuccessful || res.body() == null) {
                        Toast.makeText(
                            this@UserNotificationsActivity,
                            "Failed to load notifications",
                            Toast.LENGTH_SHORT
                        ).show()
                        return
                    }

                    val newList = res.body()!!

                    // Detect new incoming notifications (ones not seen before)
                    val newItems = newList.filter { newNotification ->
                        previousList.none { old -> old.id == newNotification.id }
                    }

                    // Trigger sound for every new notification
                    if (newItems.isNotEmpty()) {
                        for (notif in newItems) {
                            triggerLocalNotification(notif)
                        }
                    }

                    // Update RecyclerView
                    adapter.update(newList)

                    // Save list for next comparison
                    previousList = newList
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


    // 🔔 Show Android notification with user's selected sound
    private fun triggerLocalNotification(notification: NotificationModel) {
        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val rawRes = resources.getIdentifier(selectedSound, "raw", packageName)
        val soundUri = Uri.parse("android.resource://$packageName/$rawRes")

        val builder = NotificationCompat.Builder(
            this,
            MyApplication.NEW_CHAT_MESSAGES_CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle(notification.type)       // OR custom label
            .setContentText(notification.message ?: "")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSound(soundUri)
            .setAutoCancel(true)

        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(System.currentTimeMillis().toInt(), builder.build())
    }


    private fun markAsRead(id: String) {
        ApiClient.apiService.markNotificationRead(id)
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(
                    call: Call<ApiResponse>,
                    response: Response<ApiResponse>
                ) {}

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {}
            })
    }
}
