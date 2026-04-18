package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
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


class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter
    private lateinit var rvNotifications: RecyclerView
    private lateinit var progressNotifications: ProgressBar
    private lateinit var textNotificationsState: TextView

    private var previousList: List<NotificationModel> = emptyList()

    private companion object {
        const val PREFS_NAME = "settings"
        const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        const val KEY_REWARD_NOTIFICATIONS_ENABLED = "reward_notifications_enabled"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_notifications)

        TokenManager.getUserId(this)?.let { SocketManager.ensureConnected(it) }

        // RecyclerView
        rvNotifications = findViewById(R.id.rvNotifications)
        progressNotifications = findViewById(R.id.progressNotifications)
        textNotificationsState = findViewById(R.id.textNotificationsState)
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
        showLoadingState()

        ApiClient.apiService.getNotifications().enqueue(object : Callback<List<NotificationModel>> {
            override fun onResponse(
                call: Call<List<NotificationModel>>,
                res: Response<List<NotificationModel>>
            ) {
                if (!res.isSuccessful) {
                    Log.e("NOTIF", "Failed to load notifications: ${res.code()}")
                    adapter.updateList(emptyList())
                    previousList = emptyList()
                    showMessageState("Could not load notifications. Pull back and try again.")
                    return
                }

                val body = res.body()
                if (body == null) {
                    Log.e("NOTIF", "Notifications response body was empty")
                    adapter.updateList(emptyList())
                    previousList = emptyList()
                    showMessageState("No notifications yet.")
                    return
                }

                val newList = filterMutedNotifications(body)

                val newItems = newList.filter { n ->
                    previousList.none { it.id == n.id }
                }

                if (previousList.isNotEmpty()) {
                    newItems.forEach { triggerLocalNotification(it) }
                }

                adapter.updateList(newList)
                previousList = newList
                showContentState(newList)
            }

            override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                Log.e("NOTIF", "Network error loading notifications", t)
                adapter.updateList(emptyList())
                previousList = emptyList()
                showMessageState("Network error. Check your connection and try again.")
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
                    val notif = parseNotification(data)
                    if (isMutedNotification(notif)) return@runOnUiThread

                    val updated = adapter.itemsList.toMutableList()
                    updated.add(0, notif)

                    adapter.updateList(updated)
                    previousList = updated
                    showContentState(updated)
                    triggerLocalNotification(notif)

                } catch (e: Exception) {
                    Log.e("NOTIF", "Could not handle socket notification", e)
                }
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
    private fun parseNotification(data: Any): NotificationModel {
        val jsonString = when (data) {
            is JSONObject -> data.toString()
            else -> data.toString()
        }

        return Gson().fromJson(jsonString, NotificationModel::class.java)
    }

    private fun showLoadingState() {
        progressNotifications.visibility = View.VISIBLE
        textNotificationsState.visibility = View.GONE
        rvNotifications.visibility = View.GONE
    }

    private fun showContentState(items: List<NotificationModel>) {
        progressNotifications.visibility = View.GONE
        if (items.isEmpty()) {
            rvNotifications.visibility = View.GONE
            textNotificationsState.text = "No notifications yet."
            textNotificationsState.visibility = View.VISIBLE
        } else {
            textNotificationsState.visibility = View.GONE
            rvNotifications.visibility = View.VISIBLE
        }
    }

    private fun showMessageState(message: String) {
        progressNotifications.visibility = View.GONE
        rvNotifications.visibility = View.GONE
        textNotificationsState.text = message
        textNotificationsState.visibility = View.VISIBLE
    }

    private fun filterMutedNotifications(items: List<NotificationModel>): List<NotificationModel> {
        return items.filterNot { isMutedNotification(it) }
    }

    private fun isMutedNotification(notification: NotificationModel): Boolean {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val notificationsEnabled = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        val rewardNotificationsEnabled = prefs.getBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, true)

        return !notificationsEnabled || (isRewardNotification(notification) && !rewardNotificationsEnabled)
    }

    private fun isRewardNotification(notification: NotificationModel): Boolean {
        val type = notification.type.lowercase()
        val targetType = notification.targetType?.lowercase()
        return type == "reward" || type.startsWith("reward_") || targetType == "wallet"
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
        if (isMutedNotification(notification)) return
        if (!canPostLocalNotification()) return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val rawRes = resources.getIdentifier(selectedSound, "raw", packageName)
        val soundUri = if (rawRes > 0) Uri.parse("android.resource://$packageName/$rawRes") else null

        val builder = NotificationCompat.Builder(this, MyApplication.NEW_CHAT_MESSAGES_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle(notification.type)
            .setContentText(notification.message ?: "")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)

        soundUri?.let { builder.setSound(it) }

        NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun canPostLocalNotification(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }
}
