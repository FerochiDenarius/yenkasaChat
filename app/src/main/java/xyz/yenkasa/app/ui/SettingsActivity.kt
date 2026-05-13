package xyz.yenkasa.app.ui

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ImageButton
import android.widget.RadioButton
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import org.json.JSONObject
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.NotificationPreferencesResponse
import xyz.yenkasa.app.model.UpdateNotificationPreferencesRequest
import xyz.yenkasa.app.model.UserPrivacyModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import xyz.yenkasa.app.util.AppUrls
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.LocaleManager
import xyz.yenkasa.app.util.NotificationSoundManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions


class SettingsActivity : AppCompatActivity() {

    private lateinit var buttonSettingsBack: ImageButton
    private lateinit var itemPrivacyLevel: LinearLayout
    private lateinit var itemWhoYouBlocked: LinearLayout
    private lateinit var itemWhoBlockedYou: LinearLayout
    private lateinit var itemCommunityVisibility: LinearLayout
    private lateinit var itemBlockedCommunities: LinearLayout
    private lateinit var itemUsersBlockedFromPosts: LinearLayout
    private lateinit var itemLanguage: LinearLayout

    private lateinit var privacySummaryText: TextView
    private lateinit var txtLanguageCurrent: TextView

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
        "sound_default" to R.string.notification_sound_default,
        "sound_chime" to R.string.notification_sound_chime,
        "sound_bell" to R.string.notification_sound_bell,
        "sound_soft" to R.string.notification_sound_soft,
        "sound_alert" to R.string.notification_sound_alert
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        EdgeToEdgeInsets.setLightSystemBars(
            window = window,
            lightStatusBars = !isNightMode,
            lightNavigationBars = !isNightMode
        )

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
        itemLanguage = findViewById(R.id.itemLanguage)

        privacySummaryText = findViewById(R.id.privacySummaryText)
        txtLanguageCurrent = findViewById(R.id.txtLanguageCurrent)
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

        if (UserPermissions.canModerate(role)) {

            moderationHeader.visibility = View.VISIBLE
            itemModerationDashboard.visibility = View.VISIBLE
        }



        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val savedId = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val savedLabel = getString(soundOptions.firstOrNull { it.first == savedId }?.second ?: R.string.notification_sound_default)
        txtSoundCurrent.text = savedLabel
        updateLanguageSummary()

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
        itemLanguage.setOnClickListener {
            showLanguagePicker()
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
                Toast.makeText(this, getString(R.string.please_log_in_again), Toast.LENGTH_SHORT).show()
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
                    "everyone" -> privacySummaryText.text = getString(R.string.privacy_everyone)
                    "community_members" -> privacySummaryText.text = getString(R.string.privacy_community_members)
                    "requires_approval" -> privacySummaryText.text = getString(R.string.privacy_requires_approval)
                    "nobody" -> privacySummaryText.text = getString(R.string.privacy_nobody)
                }
            }

            override fun onFailure(call: retrofit2.Call<UserPrivacyModel>, t: Throwable) {
                Log.e(TAG, "Failed to load privacy", t)
            }
        })
    }

    private fun showDeleteAccountDialog() {
        AlertDialog.Builder(this)
            .setTitle(R.string.delete_account_title)
            .setMessage(R.string.delete_account_message)
            .setPositiveButton(R.string.continue_action) { _, _ ->
                openDeleteAccountPage()
            }
            .setNegativeButton(R.string.cancel, null)
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
        val labels = soundOptions.map { getString(it.second) }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(R.string.select_notification_sound)
            .setItems(labels) { _, which ->

                val selectedId = soundOptions[which].first
                val selectedLabel = getString(soundOptions[which].second)

                NotificationSoundManager.saveSelectedSound(this, selectedId)

                // Update UI label
                txtSoundCurrent.text = selectedLabel

                // Preview sound
                NotificationSoundManager.playPreview(this, selectedId)
            }
            .show()
    }

    private fun updateLanguageSummary() {
        txtLanguageCurrent.text = LocaleManager.getLanguageLabel(this)
    }

    private fun showLanguagePicker() {
        val dialog = BottomSheetDialog(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(18), dp(20), dp(18))
        }

        val title = TextView(this).apply {
            text = getString(R.string.select_language)
            setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.menu_primary_text))
            textSize = 20f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(0, 0, 0, dp(10))
        }
        container.addView(title)

        val selectedTag = LocaleManager.getCurrentLanguage(this).tag
        LocaleManager.supportedLanguages.forEach { language ->
            val option = RadioButton(this).apply {
                text = getString(language.labelRes)
                textSize = 16f
                isChecked = language.tag == selectedTag
                gravity = Gravity.CENTER_VERTICAL
                minHeight = dp(52)
                setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.menu_primary_text))
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
                setOnClickListener {
                    LocaleManager.setLocale(this@SettingsActivity, language.tag)
                    updateLanguageSummary()
                    Toast.makeText(this@SettingsActivity, getString(R.string.language_applied), Toast.LENGTH_SHORT).show()
                    dialog.dismiss()
                }
            }
            container.addView(option)
        }

        dialog.setContentView(container)
        dialog.show()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun resolveCurrentRole(): String {
        val userJson = TokenManager.getUser(this)
        if (!userJson.isNullOrBlank()) {
            runCatching {
                val json = JSONObject(userJson)
                json.optString("accessRole").takeIf { it.isNotBlank() }?.let { return it }
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
