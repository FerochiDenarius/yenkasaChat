package xyz.yenkasa.app.ui

import android.content.Intent
import android.content.res.Configuration
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.LinearLayout
import android.widget.ImageButton
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.NotificationPreferencesResponse
import xyz.yenkasa.app.model.UpdateNotificationPreferencesRequest
import xyz.yenkasa.app.model.UserPrivacyModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import xyz.yenkasa.app.util.AppUrls
import xyz.yenkasa.app.util.TokenManager


class SettingsActivity : AppCompatActivity() {

    private lateinit var buttonSettingsBack: ImageButton
    private lateinit var itemPrivacyLevel: LinearLayout
    private lateinit var itemWhoYouBlocked: LinearLayout
    private lateinit var itemWhoBlockedYou: LinearLayout
    private lateinit var itemCommunityVisibility: LinearLayout
    private lateinit var itemBlockedCommunities: LinearLayout
    private lateinit var itemUsersBlockedFromPosts: LinearLayout

    private lateinit var privacySummaryText: TextView

    private val api: ApiService by lazy { ApiClient.apiService }
    private val TAG = "SettingsActivity"
    private lateinit var itemNotificationSound: LinearLayout
    private lateinit var itemNotificationToggle: LinearLayout
    private lateinit var itemRewardNotificationToggle: LinearLayout
    private lateinit var txtSoundCurrent: TextView
    private lateinit var switchNotifications: Switch
    private lateinit var switchRewardNotifications: Switch
    private lateinit var itemDeleteAccount: LinearLayout
    private lateinit var itemModerationDashboard: LinearLayout
    private lateinit var moderationHeader: TextView
    private var updatingNotificationSwitches = false

    private companion object {
        const val PREFS_NAME = "settings"
        const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        const val KEY_REWARD_NOTIFICATIONS_ENABLED = "reward_notifications_enabled"
    }


    private val soundOptions = listOf(
        "sound_default" to "Default",
        "sound_chime" to "Chime",
        "sound_bell" to "Bell",
        "sound_soft" to "Soft",
        "sound_alert" to "Alert"
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        window.statusBarColor = ContextCompat.getColor(this, R.color.menu_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.menu_background)
        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        if (!isNightMode) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        bindViews()
        setClickListeners()
        loadPrivacySummary()
    }


    private fun bindViews() {
        buttonSettingsBack = findViewById(R.id.buttonSettingsBack)
        itemPrivacyLevel = findViewById(R.id.itemPrivacyLevel)
        itemWhoYouBlocked = findViewById(R.id.itemWhoYouBlocked)
        itemWhoBlockedYou = findViewById(R.id.itemWhoBlockedYou)
        itemCommunityVisibility = findViewById(R.id.itemCommunityVisibility)
        itemBlockedCommunities = findViewById(R.id.itemBlockedCommunities)
        itemUsersBlockedFromPosts = findViewById(R.id.itemUsersBlockedFromPosts)

        privacySummaryText = findViewById(R.id.privacySummaryText)
        itemNotificationSound = findViewById(R.id.itemNotificationSound)
        itemNotificationToggle = findViewById(R.id.itemNotificationToggle)
        itemRewardNotificationToggle = findViewById(R.id.itemRewardNotificationToggle)
        txtSoundCurrent = findViewById(R.id.txtSoundCurrent)
        switchNotifications = findViewById(R.id.switchNotifications)
        switchRewardNotifications = findViewById(R.id.switchRewardNotifications)
        itemDeleteAccount = findViewById(R.id.itemDeleteAccount)
        itemModerationDashboard = findViewById(R.id.itemModerationDashboard)
        moderationHeader = findViewById(R.id.moderationHeader)

        val role = resolveCurrentRole()

        if (role in listOf(
                "moderator",
                "admin",
                "junior_developer",
                "senior_developer"
            )) {

            moderationHeader.visibility = View.VISIBLE
            itemModerationDashboard.visibility = View.VISIBLE
        }



        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedId = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val savedLabel = soundOptions.firstOrNull { it.first == savedId }?.second ?: "Default"
        txtSoundCurrent.text = savedLabel

        switchNotifications.isChecked = prefs.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        switchRewardNotifications.isChecked = prefs.getBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, true)
        loadNotificationPreferences()

    }

    private fun setClickListeners() {
        buttonSettingsBack.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }

        // ✔ Open Privacy Selection
        itemPrivacyLevel.setOnClickListener {
            startActivity(Intent(this, PrivacySettingsActivity::class.java))
        }

        // ✔ Open list of blocked users
        itemWhoYouBlocked.setOnClickListener {
            startActivity(Intent(this, BlockedUsersActivity::class.java))
        }

        // ✔ Open list of people who blocked you
        itemWhoBlockedYou.setOnClickListener {
            startActivity(Intent(this, WhoBlockedYouActivity::class.java))
        }

        // ✔ Post Visibility → Community list
        itemCommunityVisibility.setOnClickListener {
            startActivity(Intent(this, CommunityVisibilityActivity::class.java))
        }

        // ✔ Blocked communities: cannot see your posts
        itemBlockedCommunities.setOnClickListener {
            startActivity(Intent(this, BlockedCommunitiesActivity::class.java))
        }

        // ✔ Users hidden from posts
        itemUsersBlockedFromPosts.setOnClickListener {
            startActivity(Intent(this, HiddenUsersActivity::class.java))
        }

        itemNotificationSound.setOnClickListener {
            showSoundPickerDialog()
        }
        itemNotificationToggle.setOnClickListener {
            switchNotifications.toggle()
        }
        itemRewardNotificationToggle.setOnClickListener {
            switchRewardNotifications.toggle()
        }
        switchNotifications.setOnCheckedChangeListener { _, isChecked ->
            if (updatingNotificationSwitches) return@setOnCheckedChangeListener
            saveNotificationPreferences(inAppEnabled = isChecked)
        }
        switchRewardNotifications.setOnCheckedChangeListener { _, isChecked ->
            if (updatingNotificationSwitches) return@setOnCheckedChangeListener
            saveNotificationPreferences(rewardEnabled = isChecked)
        }
        itemDeleteAccount.setOnClickListener {
            showDeleteAccountDialog()
        }

        itemModerationDashboard.setOnClickListener {
            val authToken = TokenManager.getToken(this)
            if (authToken.isNullOrBlank()) {
                Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val url = Uri.parse(AppUrls.moderationDashboard)
                .buildUpon()
                .appendQueryParameter("token", authToken)
                .build()

            val intent = Intent(
                Intent.ACTION_VIEW,
                url
            )
            startActivity(intent)
        }


    }

    private fun loadPrivacySummary() {
        api.getPrivacy().enqueue(object : retrofit2.Callback<UserPrivacyModel> {
            override fun onResponse(
                call: retrofit2.Call<UserPrivacyModel>,
                response: retrofit2.Response<UserPrivacyModel>
            ) {
                if (!response.isSuccessful || response.body() == null) return

                when (response.body()!!.privacyLevel) {
                    "everyone" -> privacySummaryText.text = "Everyone can message you"
                    "requires_approval" -> privacySummaryText.text = "Message requests required"
                    "nobody" -> privacySummaryText.text = "No one can message you"
                }
            }

            override fun onFailure(call: retrofit2.Call<UserPrivacyModel>, t: Throwable) {
                Log.e(TAG, "Failed to load privacy", t)
            }
        })
    }

    private fun showDeleteAccountDialog() {
        AlertDialog.Builder(this)
            .setTitle("Delete Account & Data")
            .setMessage(
                "This will permanently delete your Yenkasa account and associated data.\n\n" +
                        "This action cannot be undone.\n\n" +
                        "Some data may be retained if required by law."
            )
            .setPositiveButton("Continue") { _, _ ->
                openDeleteAccountPage()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
    private fun openDeleteAccountPage() {
        val url = AppUrls.deleteAccount
        val intent = Intent(Intent.ACTION_VIEW)
        intent.data = android.net.Uri.parse(url)
        startActivity(intent)
    }

    private fun loadNotificationPreferences() {
        api.getNotificationPreferences().enqueue(object : retrofit2.Callback<NotificationPreferencesResponse> {
            override fun onResponse(
                call: retrofit2.Call<NotificationPreferencesResponse>,
                response: retrofit2.Response<NotificationPreferencesResponse>
            ) {
                val preferences = response.body()?.preferences ?: return
                val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                prefs.edit()
                    .putBoolean(KEY_NOTIFICATIONS_ENABLED, preferences.inAppEnabled)
                    .putBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, preferences.rewardEnabled)
                    .apply()

                updatingNotificationSwitches = true
                switchNotifications.isChecked = preferences.inAppEnabled
                switchRewardNotifications.isChecked = preferences.rewardEnabled
                updatingNotificationSwitches = false
            }

            override fun onFailure(call: retrofit2.Call<NotificationPreferencesResponse>, t: Throwable) {
                Log.e(TAG, "Failed to load notification preferences", t)
            }
        })
    }

    private fun saveNotificationPreferences(
        inAppEnabled: Boolean? = null,
        rewardEnabled: Boolean? = null
    ) {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        prefs.edit().apply {
            inAppEnabled?.let { putBoolean(KEY_NOTIFICATIONS_ENABLED, it) }
            rewardEnabled?.let { putBoolean(KEY_REWARD_NOTIFICATIONS_ENABLED, it) }
        }.apply()

        api.updateNotificationPreferences(
            UpdateNotificationPreferencesRequest(
                inAppEnabled = inAppEnabled,
                rewardEnabled = rewardEnabled
            )
        ).enqueue(object : retrofit2.Callback<NotificationPreferencesResponse> {
            override fun onResponse(
                call: retrofit2.Call<NotificationPreferencesResponse>,
                response: retrofit2.Response<NotificationPreferencesResponse>
            ) {
                if (!response.isSuccessful) {
                    Log.e(TAG, "Failed to save notification preferences: ${response.code()}")
                }
            }

            override fun onFailure(call: retrofit2.Call<NotificationPreferencesResponse>, t: Throwable) {
                Log.e(TAG, "Failed to save notification preferences", t)
            }
        })
    }

    private fun showSoundPickerDialog() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

        val labels = soundOptions.map { it.second }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Select Notification Sound")
            .setItems(labels) { _, which ->

                val selectedId = soundOptions[which].first
                val selectedLabel = soundOptions[which].second

                // Save selection
                prefs.edit().putString("notification_sound", selectedId).apply()

                // Update UI label
                txtSoundCurrent.text = selectedLabel

                // Preview sound
                val resId = resources.getIdentifier(selectedId, "raw", packageName)
                MediaPlayer.create(this, resId).start()
            }
            .show()
    }

    private fun resolveCurrentRole(): String {
        val userJson = TokenManager.getUser(this)
        if (!userJson.isNullOrBlank()) {
            runCatching {
                val json = JSONObject(userJson)
                json.optString("roleName").takeIf { it.isNotBlank() }?.let { return it }
                when (val roleValue = json.opt("role")) {
                    is JSONObject -> roleValue.optString("name").takeIf { it.isNotBlank() }?.let { return it }
                    is String -> roleValue.takeIf { it.isNotBlank() }?.let { return it }
                }
            }.onFailure {
                Log.w(TAG, "Unable to parse role JSON: ${it.message}")
            }
        }
        return TokenManager.getUserRole(this)
    }

}
