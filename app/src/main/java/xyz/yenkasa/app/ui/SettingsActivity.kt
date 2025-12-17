package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import xyz.yenkasa.app.model.UserPrivacyModel
import android.widget.Switch
import androidx.appcompat.app.AlertDialog
import android.media.MediaPlayer







class SettingsActivity : AppCompatActivity() {

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
    private lateinit var txtSoundCurrent: TextView
    private lateinit var switchNotifications: Switch
    private lateinit var itemDeleteAccount: LinearLayout

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

        bindViews()
        setClickListeners()
        loadPrivacySummary()
    }


    private fun bindViews() {
        itemPrivacyLevel = findViewById(R.id.itemPrivacyLevel)
        itemWhoYouBlocked = findViewById(R.id.itemWhoYouBlocked)
        itemWhoBlockedYou = findViewById(R.id.itemWhoBlockedYou)
        itemCommunityVisibility = findViewById(R.id.itemCommunityVisibility)
        itemBlockedCommunities = findViewById(R.id.itemBlockedCommunities)
        itemUsersBlockedFromPosts = findViewById(R.id.itemUsersBlockedFromPosts)

        privacySummaryText = findViewById(R.id.privacySummaryText)
        itemNotificationSound = findViewById(R.id.itemNotificationSound)
        itemNotificationToggle = findViewById(R.id.itemNotificationToggle)
        txtSoundCurrent = findViewById(R.id.txtSoundCurrent)
        switchNotifications = findViewById(R.id.switchNotifications)
        itemDeleteAccount = findViewById(R.id.itemDeleteAccount)


        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val savedId = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val savedLabel = soundOptions.firstOrNull { it.first == savedId }?.second ?: "Default"
        txtSoundCurrent.text = savedLabel


    }

    private fun setClickListeners() {

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
        itemDeleteAccount.setOnClickListener {
            showDeleteAccountDialog()
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
        val url = "https://yenkasa-bldrv.ondigitalocean.app/delete-account"
        val intent = Intent(Intent.ACTION_VIEW)
        intent.data = android.net.Uri.parse(url)
        startActivity(intent)
    }

    private fun showSoundPickerDialog() {
        val prefs = getSharedPreferences("settings", MODE_PRIVATE)

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

}
