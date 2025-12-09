package com.example.yenkasachat.ui

import android.app.NotificationManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.MyApplication
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.NotificationAdapter
import com.example.yenkasachat.model.ApiResponse
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.model.NotificationModel
import com.example.yenkasachat.network.ApiClient
import com.google.gson.Gson
import io.socket.client.Socket
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter
    private lateinit var rvNotifications: RecyclerView
    private lateinit var socket: Socket

    private var previousList: List<NotificationModel> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_notifications)

        // Socket
        socket = MyApplication.getSocket()

        // RecyclerView
        rvNotifications = findViewById(R.id.rvNotifications)
        rvNotifications.layoutManager = LinearLayoutManager(this)

        adapter = NotificationAdapter(
            items = mutableListOf(),
            onItemClick = { item -> handleNotificationClick(item) },
            onSwipeDelete = { item -> markAsRead(item.id) }
        )

        rvNotifications.adapter = adapter
        adapter.attachSwipeToRecyclerView(rvNotifications)

        loadNotifications()
        initSocketListeners()
    }

    override fun onDestroy() {
        super.onDestroy()
        socket.off("notificationCreated")
        socket.off("notificationRead")
    }

    // ============================================================
    // LOAD EXISTING NOTIFICATIONS
    // ============================================================
    private fun loadNotifications() {
        ApiClient.apiService.getNotifications().enqueue(object : Callback<List<NotificationModel>> {
            override fun onResponse(
                call: Call<List<NotificationModel>>,
                res: Response<List<NotificationModel>>
            ) {
                val newList = res.body() ?: return

                val newItems = newList.filter { n ->
                    previousList.none { it.id == n.id }
                }

                newItems.forEach { triggerLocalNotification(it) }

                adapter.updateList(newList)
                previousList = newList
            }

            override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                Toast.makeText(this@UserNotificationsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // ============================================================
    // SOCKET REAL-TIME LISTENERS
    // ============================================================
    private fun initSocketListeners() {

        // Push new notification
        socket.on("notificationCreated") { args ->
            runOnUiThread {
                try {
                    val notif = parseNotification(args[0].toString())
                    val updated = adapter.itemsList.toMutableList()
                    updated.add(0, notif)

                    adapter.updateList(updated)
                    triggerLocalNotification(notif)

                } catch (e: Exception) { e.printStackTrace() }
            }
        }

        socket.on("notificationRead") { args ->
            runOnUiThread {
                try {
                    val json = JSONObject(args[0].toString())
                    val id = json.getString("id")
                    adapter.removeById(id)
                } catch (_: Exception) {}
            }
        }
    }

    // JSON → Model
    private fun parseNotification(jsonString: String): NotificationModel {
        return Gson().fromJson(jsonString, NotificationModel::class.java)
    }

    // ============================================================
    // WHEN USER TAPS A NOTIFICATION
    // ============================================================
    private fun handleNotificationClick(item: NotificationModel) {

        markAsRead(item.id)
        adapter.removeById(item.id)

        val url = when (item.type.lowercase()) {
            "post_approved" -> "/post/approval/${item.postId}"
            "comment" -> "/post/${item.postId}?openComments=true"
            "like", "post_liked" -> "/post/${item.postId}"
            "follow" -> "/profile/${item.senderId}"
            else -> null
        }

        if (url != null) {
            Toast.makeText(this, "Navigate to: $url", Toast.LENGTH_SHORT).show()
        }
    }

    // ============================================================
    // MARK AS READ
    // ============================================================
    private fun markAsRead(id: String) {

        // Get token normally used by ApiClient's interceptor
        val token = TokenManager.getToken(applicationContext)

        ApiClient.apiService
            .markNotificationRead(id, "Bearer $token")   // <── pass header explicitly
            .enqueue(object : Callback<ApiResponse> {

                override fun onResponse(
                    call: Call<ApiResponse>,
                    response: Response<ApiResponse>
                ) {
                    if (!response.isSuccessful) {
                        // rollback or log
                        return
                    }

                    // API success — notification is read on backend
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    // rollback or log
                }
            })
    }

    // ============================================================
    // PLAY LOCAL NOTIFICATION SOUND
    // ============================================================
    private fun triggerLocalNotification(notification: NotificationModel) {
        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val rawRes = resources.getIdentifier(selectedSound, "raw", packageName)
        val soundUri = Uri.parse("android.resource://$packageName/$rawRes")

        val builder = NotificationCompat.Builder(this, MyApplication.NEW_CHAT_MESSAGES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle(notification.type)
            .setContentText(notification.message ?: "")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setSound(soundUri)
            .setAutoCancel(true)

        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
