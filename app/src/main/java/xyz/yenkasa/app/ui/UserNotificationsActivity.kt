package xyz.yenkasa.app.ui

import android.app.NotificationManager
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.MyApplication
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.NotificationAdapter
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.model.NotificationModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import com.google.gson.Gson
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.content.Intent
import android.util.Log


class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter
    private lateinit var rvNotifications: RecyclerView

    private var previousList: List<NotificationModel> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_notifications)

        TokenManager.getUserId(this)?.let { SocketManager.ensureConnected(it) }

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
        SocketManager.off("notificationCreated")
        SocketManager.off("notificationRead")
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
        SocketManager.on("notificationCreated") { data ->
            runOnUiThread {
                try {
                    val notif = parseNotification(data.toString())
                    val updated = adapter.itemsList.toMutableList()
                    updated.add(0, notif)

                    adapter.updateList(updated)
                    triggerLocalNotification(notif)

                } catch (e: Exception) { e.printStackTrace() }
            }
        }

        SocketManager.on("notificationRead") { data ->
            runOnUiThread {
                try {
                    val json = JSONObject(data.toString())
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

        // Remove visually & mark backend as read
        adapter.removeById(item.id)
        markAsRead(item.id)

        // Navigate correctly
        navigateFromNotification(item)
    }


    private fun navigateFromNotification(item: NotificationModel) {

        val type = item.type?.lowercase()
        val targetType = item.targetType?.lowercase()
        val targetId = item.targetId
        val postId = item.postId ?: item.activityId

        // ------------------------------------------------------
        // PRIMARY ROUTING USING targetType
        // ------------------------------------------------------
        when (targetType) {

            // ------------------------------------------------------
            // PROFILE NOTIFICATIONS (follow, blocked, profile_view)
            // ------------------------------------------------------
            "profile" -> {
                val intent = Intent(this, UserProfileActivity::class.java)
                intent.putExtra("USER_ID", targetId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // POST NOTIFICATIONS (post_like, post_comment, post_reply)
            // ------------------------------------------------------
            "post" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", targetId ?: postId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // COMMENT NOTIFICATIONS (comment_like, comment_reply)
            // ------------------------------------------------------
            "comment" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", postId)
                intent.putExtra("openComments", true)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // SYSTEM NOTIFICATIONS (system_block, system_unblock)
            // ------------------------------------------------------
            "system" -> {
                when (type) {
                    "system_block" ->
                        Toast.makeText(this, "Your account has been restricted.", Toast.LENGTH_LONG).show()

                    "system_unblock" ->
                        Toast.makeText(this, "Your restrictions have been removed.", Toast.LENGTH_LONG).show()

                    else ->
                        Toast.makeText(this, item.message ?: "System notification", Toast.LENGTH_SHORT).show()
                }
                return
            }

            "wallet" -> {
                startActivity(Intent(this, CoinWalletActivity::class.java))
                return
            }
        }

        // ------------------------------------------------------
        // SECONDARY ROUTING USING type (full explicit mapping)
        // ------------------------------------------------------
        when (type) {

            // ------------------------------------------------------
            // FOLLOW NOTIFICATIONS
            // ------------------------------------------------------
            "follow", "new_follower", "follow_request", "follow_accepted" -> {
                val intent = Intent(this, UserProfileActivity::class.java)
                intent.putExtra("USER_ID", targetId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // POST LIKES
            // ------------------------------------------------------
            "post_like" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", postId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // POST COMMENTS
            // ------------------------------------------------------
            "post_comment" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", postId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // COMMENT REPLIES
            // ------------------------------------------------------
            "comment_reply" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", postId)
                intent.putExtra("openComments", true)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // COMMENT LIKES
            // ------------------------------------------------------
            "comment_like" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", postId)
                intent.putExtra("openComments", true)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // USER BLOCK NOTIFICATIONS
            // ------------------------------------------------------
            "blocked" -> {
                val intent = Intent(this, UserProfileActivity::class.java)
                intent.putExtra("USER_ID", targetId)   // open blocker profile
                startActivity(intent)
                return
            }

            "unblocked" -> {
                val intent = Intent(this, UserProfileActivity::class.java)
                intent.putExtra("USER_ID", targetId)
                startActivity(intent)
                return
            }

            // ------------------------------------------------------
            // POST APPROVAL OR REVIEW
            // ------------------------------------------------------
            "post_under_review" -> {
                Toast.makeText(this, item.message ?: "Your post is under review", Toast.LENGTH_LONG).show()
                return
            }

            "post_approved" -> {
                val intent = Intent(this, CommentsActivity::class.java)
                intent.putExtra("POST_ID", targetId)
                startActivity(intent)
                return
            }

            "reward", "reward_post", "reward_comment", "reward_comment_like",
            "reward_post_like", "reward_post_view", "reward_post_view_received",
            "reward_follow", "reward_verification", "reward_daily_login" -> {
                startActivity(Intent(this, CoinWalletActivity::class.java))
                return
            }

            // ------------------------------------------------------
            // FALLBACK
            // ------------------------------------------------------
            else -> {
                item.targetUrl?.let { url ->
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } ?: Toast.makeText(this, "No navigation available", Toast.LENGTH_SHORT).show()
            }
        }
    }

    // ============================================================
    // MARK AS READ
    // ============================================================
    private fun markAsRead(id: String) {
        val token = TokenManager.getToken(applicationContext)

        ApiClient.apiService
            .markNotificationRead(id, "Bearer $token")
            .enqueue(object : Callback<ApiResponse> {

                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (!response.isSuccessful) {
                        Log.e("NOTIF", "Failed to mark read: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Log.e("NOTIF", "Error marking read: ${t.message}")
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
