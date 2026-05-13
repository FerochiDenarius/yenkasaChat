package xyz.yenkasa.app.ui

import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.bumptech.glide.Glide
import de.hdodenhof.circleimageview.CircleImageView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.NotificationModel
import xyz.yenkasa.app.model.UserPrivacyModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import xyz.yenkasa.app.util.TokenManager
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class PrivacySettingsActivity : AppCompatActivity() {

    private val api: ApiService by lazy { ApiClient.apiService }
    private var selectedLevel = "requires_approval"
    private var messageRequests = mutableListOf<NotificationModel>()

    private lateinit var optionEveryone: LinearLayout
    private lateinit var optionCommunity: LinearLayout
    private lateinit var optionApproval: LinearLayout
    private lateinit var optionNobody: LinearLayout
    private lateinit var indicatorEveryone: View
    private lateinit var indicatorCommunity: View
    private lateinit var indicatorApproval: View
    private lateinit var indicatorNobody: View
    private lateinit var btnSave: Button
    private lateinit var txtRequestsHeader: TextView
    private lateinit var messageRequestsList: LinearLayout
    private lateinit var txtRequestsEmpty: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_privacy_settings)

        bindViews()
        setupSelection()
        loadCurrentPrivacy()
        loadMessageRequests()
    }

    private fun bindViews() {
        optionEveryone = findViewById(R.id.optionEveryone)
        optionCommunity = findViewById(R.id.optionCommunity)
        optionApproval = findViewById(R.id.optionApproval)
        optionNobody = findViewById(R.id.optionNobody)
        indicatorEveryone = findViewById(R.id.indicatorEveryone)
        indicatorCommunity = findViewById(R.id.indicatorCommunity)
        indicatorApproval = findViewById(R.id.indicatorApproval)
        indicatorNobody = findViewById(R.id.indicatorNobody)
        btnSave = findViewById(R.id.btnSavePrivacy)
        txtRequestsHeader = findViewById(R.id.txtMessageRequestsHeader)
        messageRequestsList = findViewById(R.id.messageRequestsList)
        txtRequestsEmpty = findViewById(R.id.txtMessageRequestsEmpty)
        btnSave.backgroundTintList = null
    }

    private fun setupSelection() {
        optionEveryone.setOnClickListener { selectLevel("everyone") }
        optionCommunity.setOnClickListener { selectLevel("community_members") }
        optionApproval.setOnClickListener { selectLevel("requires_approval") }
        optionNobody.setOnClickListener { selectLevel("nobody") }

        btnSave.setOnClickListener { savePrivacy(selectedLevel) }
        selectLevel(selectedLevel)
    }

    private fun selectLevel(level: String) {
        selectedLevel = level
        indicatorEveryone.setBackgroundResource(
            if (level == "everyone") R.drawable.bg_privacy_indicator_selected else R.drawable.bg_privacy_indicator_unselected
        )
        indicatorApproval.setBackgroundResource(
            if (level == "requires_approval") R.drawable.bg_privacy_indicator_selected else R.drawable.bg_privacy_indicator_unselected
        )
        indicatorNobody.setBackgroundResource(
            if (level == "nobody") R.drawable.bg_privacy_indicator_selected else R.drawable.bg_privacy_indicator_unselected
        )
        indicatorCommunity.setBackgroundResource(
            if (level == "community_members") R.drawable.bg_privacy_indicator_selected else R.drawable.bg_privacy_indicator_unselected
        )
    }

    private fun loadCurrentPrivacy() {
        api.getPrivacy().enqueue(object : Callback<UserPrivacyModel> {
            override fun onResponse(call: Call<UserPrivacyModel>, response: Response<UserPrivacyModel>) {
                if (response.isSuccessful && response.body() != null) {
                    when (response.body()!!.privacyLevel) {
                        "everyone", "community_members", "requires_approval", "nobody" -> selectLevel(response.body()!!.privacyLevel)
                    }
                }
            }

            override fun onFailure(call: Call<UserPrivacyModel>, t: Throwable) {
                Toast.makeText(this@PrivacySettingsActivity, R.string.failed_to_load_settings, Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun savePrivacy(level: String) {
        btnSave.isEnabled = false
        api.setPrivacy(level).enqueue(object : Callback<ApiResponse> {
            override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                btnSave.isEnabled = true
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    response.body()?.message ?: if (response.isSuccessful) {
                        getString(R.string.saved)
                    } else {
                        getString(R.string.could_not_save_privacy_setting)
                    },
                    Toast.LENGTH_SHORT
                ).show()
                if (response.isSuccessful) finish()
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                btnSave.isEnabled = true
                Toast.makeText(this@PrivacySettingsActivity, R.string.failed_to_save, Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun loadMessageRequests() {
        api.getNotifications().enqueue(object : Callback<List<NotificationModel>> {
            override fun onResponse(call: Call<List<NotificationModel>>, response: Response<List<NotificationModel>>) {
                val requests = response.body().orEmpty()
                    .filter { it.type == "message_request" && it.status == "unread" }
                    .sortedByDescending { it.createdAt.orEmpty() }
                messageRequests = requests.toMutableList()
                renderMessageRequests()
            }

            override fun onFailure(call: Call<List<NotificationModel>>, t: Throwable) {
                messageRequests.clear()
                renderMessageRequests()
            }
        })
    }

    private fun renderMessageRequests() {
        txtRequestsHeader.text = getString(R.string.message_requests_count, messageRequests.size)
        messageRequestsList.removeAllViews()
        messageRequestsList.visibility = if (messageRequests.isEmpty()) View.GONE else View.VISIBLE
        txtRequestsEmpty.visibility = if (messageRequests.isEmpty()) View.VISIBLE else View.GONE

        messageRequests.forEachIndexed { index, request ->
            if (index > 0) messageRequestsList.addView(divider())
            messageRequestsList.addView(requestRow(request))
        }
    }

    private fun requestRow(item: NotificationModel): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(14), dp(12), dp(14))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val avatar = CircleImageView(this).apply {
            layoutParams = LinearLayout.LayoutParams(dp(48), dp(48)).apply {
                marginEnd = dp(12)
            }
        }
        Glide.with(this)
            .load(item.sender?.avatar)
            .placeholder(R.drawable.ic_user_placeholder)
            .error(R.drawable.ic_user_placeholder)
            .into(avatar)

        val textColumn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val name = TextView(this).apply {
            text = item.sender?.username ?: getString(R.string.message_request)
            setTextColor(ContextCompat.getColor(this@PrivacySettingsActivity, R.color.menu_primary_text))
            textSize = 13f
            setTypeface(null, android.graphics.Typeface.BOLD)
            maxLines = 1
        }
        val preview = TextView(this).apply {
            text = item.message?.takeIf { it.isNotBlank() } ?: getString(R.string.wants_to_message_you)
            setTextColor(ContextCompat.getColor(this@PrivacySettingsActivity, R.color.menu_secondary_text))
            textSize = 12f
            maxLines = 1
        }
        val time = TextView(this).apply {
            text = formatRelativeTime(item.createdAt)
            setTextColor(ContextCompat.getColor(this@PrivacySettingsActivity, R.color.menu_secondary_text))
            textSize = 11f
            maxLines = 1
        }
        textColumn.addView(name)
        textColumn.addView(preview)
        textColumn.addView(time)

        val reject = actionButton(getString(R.string.reject), filled = false).apply {
            setOnClickListener { rejectRequest(item) }
        }
        val allow = actionButton(getString(R.string.allow), filled = true).apply {
            setOnClickListener { allowRequest(item) }
        }

        row.addView(avatar)
        row.addView(textColumn)
        row.addView(reject)
        row.addView(allow)
        return row
    }

    private fun actionButton(text: String, filled: Boolean): TextView {
        return TextView(this).apply {
            this.text = text
            gravity = Gravity.CENTER
            textSize = 13f
            setTypeface(null, android.graphics.Typeface.BOLD)
            minWidth = dp(60)
            minHeight = dp(38)
            setPadding(dp(12), 0, dp(12), 0)
            setBackgroundResource(if (filled) R.drawable.bg_privacy_allow_button else R.drawable.bg_privacy_reject_button)
            setTextColor(
                ContextCompat.getColor(
                    this@PrivacySettingsActivity,
                    if (filled) R.color.white else R.color.menu_primary_text
                )
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(38)
            ).apply {
                marginStart = dp(8)
            }
        }
    }

    private fun allowRequest(item: NotificationModel) {
        removeRequest(item.id)
        api.approveMessageRequest(item.id).enqueue(object : Callback<ApiResponse> {
            override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    if (response.isSuccessful) {
                        getString(R.string.message_request_approved)
                    } else {
                        getString(R.string.could_not_approve_request)
                    },
                    Toast.LENGTH_SHORT
                ).show()
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun rejectRequest(item: NotificationModel) {
        removeRequest(item.id)
        val token = TokenManager.getToken(this)
        if (token.isNullOrBlank()) return
        api.markNotificationRead(item.id, "Bearer $token").enqueue(object : Callback<ApiResponse> {
            override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                Toast.makeText(this@PrivacySettingsActivity, R.string.message_request_rejected, Toast.LENGTH_SHORT).show()
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun removeRequest(id: String) {
        messageRequests.removeAll { it.id == id }
        renderMessageRequests()
    }

    private fun divider(): View {
        return View(this).apply {
            setBackgroundColor(ContextCompat.getColor(this@PrivacySettingsActivity, R.color.menu_surface_stroke))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                1
            ).apply {
                marginStart = dp(72)
            }
        }
    }

    private fun formatRelativeTime(iso: String?): String {
        if (iso == null) return getString(R.string.just_now)
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(iso) ?: return getString(R.string.just_now)
            val diff = Date().time - date.time
            when {
                diff < 60000 -> getString(R.string.just_now)
                diff < 3600000 -> getString(R.string.minutes_ago, diff / 60000)
                diff < 86400000 -> getString(R.string.hours_ago, diff / 3600000)
                else -> getString(R.string.days_ago, diff / 86400000)
            }
        } catch (e: Exception) {
            getString(R.string.just_now)
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}
