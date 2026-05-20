package xyz.yenkasa.app.ui

import android.Manifest
import android.content.res.Configuration
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.NotificationAdapter
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.model.NotificationModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.google.android.material.chip.ChipGroup
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.util.NotificationNavigation
import xyz.yenkasa.app.util.NotificationSoundManager


class UserNotificationsActivity : AppCompatActivity() {

    private lateinit var adapter: NotificationAdapter
    private lateinit var rvNotifications: RecyclerView
    private lateinit var progressNotifications: ProgressBar
    private lateinit var textNotificationsState: TextView
    private lateinit var chipGroupFilters: ChipGroup
    private lateinit var swipeNotifications: SwipeRefreshLayout

    private var previousList: List<NotificationModel> = emptyList()
    private var allNotifications: List<NotificationModel> = emptyList()
    private var allUpdates: List<NotificationModel> = emptyList()
    private var activeFilter: NotificationFilter = NotificationFilter.ALL

    private companion object {
        const val PREFS_NAME = "settings"
        const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        const val KEY_REWARD_NOTIFICATIONS_ENABLED = "reward_notifications_enabled"
        const val KEY_UPDATES_CACHE = "updates_cache"
        const val KEY_UPDATES_READ_IDS = "updates_read_ids"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        setContentView(R.layout.activity_user_notifications)

        TokenManager.getUserId(this)?.let { SocketManager.ensureConnected(it) }

        // RecyclerView
        rvNotifications = findViewById(R.id.rvNotifications)
        progressNotifications = findViewById(R.id.progressNotifications)
        textNotificationsState = findViewById(R.id.textNotificationsState)
        chipGroupFilters = findViewById(R.id.chipGroupNotificationFilters)
        swipeNotifications = findViewById(R.id.swipeNotifications)
        rvNotifications.layoutManager = LinearLayoutManager(this)
        swipeNotifications.setColorSchemeResources(R.color.notification_badge_text)

        adapter = NotificationAdapter(
            items = mutableListOf(),
            onItemClick = { item -> handleNotificationClick(item) },
            onSwipeDelete = { item ->
                allNotifications = allNotifications.filterNot { it.id == item.id }
                markAsRead(item.id)
            }
        )

        rvNotifications.adapter = adapter
        adapter.attachSwipeToRecyclerView(rvNotifications)
        swipeNotifications.setOnRefreshListener {
            refreshContent(fromSwipe = true)
        }
        findViewById<View>(R.id.btnNotificationSettings).setOnClickListener {
            startActivity(android.content.Intent(this, SettingsActivity::class.java))
        }
        initFilters()

        refreshContent()
        initSocketListeners()
    }

    private fun configureSystemBars() {
        val backgroundColor = ContextCompat.getColor(this, R.color.notification_page_background)
        window.statusBarColor = backgroundColor
        window.navigationBarColor = backgroundColor

        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val lightBars = nightMode != Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightBars
            isAppearanceLightNavigationBars = lightBars
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        SocketManager.off("notificationCreated")
        SocketManager.off("notificationRead")
    }

    // ============================================================
    // LOAD EXISTING NOTIFICATIONS
    // ============================================================
    private fun refreshContent(fromSwipe: Boolean = false) {
        if (!fromSwipe) {
            showLoadingState()
        }
        loadNotifications()
        loadUpdates()
    }

    private fun loadNotifications() {
        if (!swipeNotifications.isRefreshing) {
            progressNotifications.visibility = View.VISIBLE
        }

        ApiClient.apiService.getNotifications().enqueue(object : Callback<List<NotificationModel>> {
            override fun onResponse(
                call: Call<List<NotificationModel>>,
                res: Response<List<NotificationModel>>
            ) {
                if (!res.isSuccessful) {
                    Log.e("NOTIF", "Failed to load notifications: ${res.code()}")
                    allNotifications = emptyList()
                    previousList = emptyList()
                    renderFilteredNotifications()
                    swipeNotifications.isRefreshing = false
                    return
                }

                val body = res.body()
                if (body == null) {
                    Log.e("NOTIF", "Notifications response body was empty")
                    allNotifications = emptyList()
                    previousList = emptyList()
                    renderFilteredNotifications()
                    swipeNotifications.isRefreshing = false
                    return
                }

                val newList = filterMutedNotifications(body)

                val newItems = newList.filter { n ->
                    previousList.none { it.id == n.id }
                }

                if (previousList.isNotEmpty()) {
                    newItems.forEach { triggerLocalNotification(it) }
                }

                allNotifications = newList
                renderFilteredNotifications()
                previousList = newList
                swipeNotifications.isRefreshing = false
            }

            override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                Log.e("NOTIF", "Network error loading notifications", t)
                allNotifications = emptyList()
                previousList = emptyList()
                renderFilteredNotifications()
                swipeNotifications.isRefreshing = false
                Toast.makeText(
                    this@UserNotificationsActivity,
                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun loadUpdates() {
        ApiClient.apiService.getUpdates().enqueue(object : Callback<List<NotificationModel>> {
            override fun onResponse(
                call: Call<List<NotificationModel>>,
                response: Response<List<NotificationModel>>
            ) {
                if (!response.isSuccessful) {
                    Log.e("NOTIF", "Failed to load updates: ${response.code()}")
                    allUpdates = loadCachedUpdates()
                    renderFilteredNotifications()
                    swipeNotifications.isRefreshing = false
                    return
                }

                val updates = applyLocalUpdateReadState(response.body().orEmpty())
                allUpdates = updates
                cacheUpdates(updates)
                renderFilteredNotifications()
                swipeNotifications.isRefreshing = false
            }

            override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                Log.e("NOTIF", "Network error loading updates", t)
                allUpdates = loadCachedUpdates()
                renderFilteredNotifications()
                swipeNotifications.isRefreshing = false
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

                    val updated = allNotifications.toMutableList()
                    updated.add(0, notif)

                    allNotifications = updated
                    renderFilteredNotifications()
                    previousList = updated
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
                    allNotifications = allNotifications.filterNot { it.id == id }
                    renderFilteredNotifications()
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
        swipeNotifications.visibility = View.GONE
    }

    private fun showContentState(items: List<NotificationModel>) {
        progressNotifications.visibility = View.GONE
        if (items.isEmpty()) {
            swipeNotifications.visibility = View.GONE
            textNotificationsState.text = when (activeFilter) {
                NotificationFilter.UPDATES -> getString(R.string.no_updates_yet)
                else -> getString(R.string.notifications_all_caught_up)
            }
            textNotificationsState.visibility = View.VISIBLE
        } else {
            textNotificationsState.visibility = View.GONE
            swipeNotifications.visibility = View.VISIBLE
        }
    }

    private fun showMessageState(message: String) {
        progressNotifications.visibility = View.GONE
        swipeNotifications.visibility = View.GONE
        textNotificationsState.text = message
        textNotificationsState.visibility = View.VISIBLE
    }

    private fun filterMutedNotifications(items: List<NotificationModel>): List<NotificationModel> {
        return items.filterNot { isMutedNotification(it) }
    }

    private fun initFilters() {
        chipGroupFilters.setOnCheckedStateChangeListener { _, checkedIds ->
            activeFilter = when (checkedIds.firstOrNull()) {
                R.id.chipFilterRewards -> NotificationFilter.REWARDS
                R.id.chipFilterComments -> NotificationFilter.COMMENTS
                R.id.chipFilterLikes -> NotificationFilter.LIKES
                R.id.chipFilterUpdates -> NotificationFilter.UPDATES
                R.id.chipFilterMentions -> NotificationFilter.MENTIONS
                else -> NotificationFilter.ALL
            }
            renderFilteredNotifications()
        }
    }

    private fun renderFilteredNotifications() {
        val filtered = when (activeFilter) {
            NotificationFilter.UPDATES -> allUpdates
                .sortedWith(compareByDescending<NotificationModel> { it.pinned }
                    .thenByDescending { it.createdAt.orEmpty() })
            NotificationFilter.ALL -> (allNotifications + allUpdates)
                .sortedWith(compareByDescending<NotificationModel> { it.pinned }
                    .thenByDescending { it.createdAt.orEmpty() })
            else -> allNotifications.filter { activeFilter.matches(it) }
        }
        adapter.updateList(filtered)
        showContentState(filtered)
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
        if (isUpdateItem(item)) {
            markUpdateAsRead(item.id)
            navigateFromNotification(item)
            return
        }

        if (item.type.equals("message_request", ignoreCase = true)) {
            showMessageRequestDialog(item)
            return
        }

        // Remove visually & mark backend as read
        allNotifications = allNotifications.filterNot { it.id == item.id }
        adapter.removeById(item.id)
        markAsRead(item.id)

        // Navigate correctly
        navigateFromNotification(item)
    }

    private fun showMessageRequestDialog(item: NotificationModel) {
        val requesterName = item.sender?.username ?: getString(R.string.this_user)

        AlertDialog.Builder(this)
            .setTitle(R.string.message_request)
            .setMessage(getString(R.string.message_request_from_user, requesterName))
            .setPositiveButton(R.string.approve) { _, _ ->
                approveMessageRequest(item)
            }
            .setNegativeButton(R.string.view_profile) { _, _ ->
                navigateFromNotification(item)
            }
            .setNeutralButton(R.string.cancel, null)
            .show()
    }

    private fun approveMessageRequest(item: NotificationModel) {
        ApiClient.apiService.approveMessageRequest(item.id)
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (response.isSuccessful) {
                        allNotifications = allNotifications.filterNot { it.id == item.id }
                        adapter.removeById(item.id)
                        markAsRead(item.id)
                        Toast.makeText(
                            this@UserNotificationsActivity,
                            R.string.message_request_approved,
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            this@UserNotificationsActivity,
                            R.string.could_not_approve_request,
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Toast.makeText(
                        this@UserNotificationsActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }


    private fun navigateFromNotification(item: NotificationModel) {
        if (item.targetType.equals("system", ignoreCase = true) && !isUpdateItem(item)) {
            Toast.makeText(this, item.message ?: getString(R.string.system_notification), Toast.LENGTH_SHORT).show()
        }
        startActivity(NotificationNavigation.buildIntent(this, item))
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

        val channelId = NotificationSoundManager.ensureMessageChannel(this)
        val soundUri = NotificationSoundManager.getSoundUri(this)

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_bell)
            .setContentTitle(notification.type)
            .setContentText(notification.message ?: "")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(NotificationNavigation.buildPendingIntent(this, notification))

        builder.setSound(soundUri)

        NotificationManagerCompat.from(this).notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun canPostLocalNotification(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    private fun applyLocalUpdateReadState(items: List<NotificationModel>): List<NotificationModel> {
        val readIds = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getStringSet(KEY_UPDATES_READ_IDS, emptySet())
            .orEmpty()

        return items.map { item ->
            if (item.id in readIds) item.copy(status = "read") else item
        }
    }

    private fun markUpdateAsRead(id: String) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val updatedReadIds = prefs.getStringSet(KEY_UPDATES_READ_IDS, emptySet()).orEmpty().toMutableSet()
        if (updatedReadIds.add(id)) {
            prefs.edit().putStringSet(KEY_UPDATES_READ_IDS, updatedReadIds).apply()
        }
        allUpdates = allUpdates.map { if (it.id == id) it.copy(status = "read") else it }
        adapter.markItemAsRead(id)
    }

    private fun cacheUpdates(items: List<NotificationModel>) {
        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .putString(KEY_UPDATES_CACHE, Gson().toJson(items))
            .apply()
    }

    private fun loadCachedUpdates(): List<NotificationModel> {
        val raw = getSharedPreferences(PREFS_NAME, MODE_PRIVATE).getString(KEY_UPDATES_CACHE, null)
            ?: return emptyList()
        return runCatching {
            val type = object : TypeToken<List<NotificationModel>>() {}.type
            applyLocalUpdateReadState(Gson().fromJson(raw, type) ?: emptyList())
        }.getOrElse {
            emptyList()
        }
    }

    private fun isUpdateItem(item: NotificationModel): Boolean {
        return item.type.lowercase().startsWith("update_")
    }

    private enum class NotificationFilter {
        ALL,
        REWARDS,
        COMMENTS,
        LIKES,
        UPDATES,
        MENTIONS;

        fun matches(notification: NotificationModel): Boolean {
            val type = notification.type.lowercase()
            val message = notification.message.orEmpty().lowercase()
            return when (this) {
                ALL -> true
                REWARDS -> type == "reward" || type.startsWith("reward_") || notification.targetType?.lowercase() == "wallet"
                COMMENTS -> "comment" in type || "reply" in type
                LIKES -> "like" in type
                UPDATES -> type.startsWith("update_")
                MENTIONS -> "mention" in type || "mentioned" in message
            }
        }
    }
}
