package xyz.yenkasa.app.ui

import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.EconomySummary
import xyz.yenkasa.app.model.EconomySummaryResponse
import xyz.yenkasa.app.model.FraudAlertsResponse
import xyz.yenkasa.app.model.TopCreator
import xyz.yenkasa.app.model.TopCreatorsResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import java.text.NumberFormat
import java.util.Locale

class AdminEconomyActivity : AppCompatActivity() {

    private val tag = "AdminEconomyActivity"
    private lateinit var statusText: TextView
    private lateinit var cardGrid: GridLayout
    private lateinit var creatorsList: LinearLayout
    private lateinit var fraudList: LinearLayout

    private var completedRequests = 0
    private var failedRequests = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_economy)

        window.statusBarColor = ContextCompat.getColor(this, R.color.menu_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.menu_background)
        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        if (!isNightMode) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        statusText = findViewById(R.id.textAdminEconomyStatus)
        cardGrid = findViewById(R.id.gridAdminEconomyCards)
        creatorsList = findViewById(R.id.listTopCreators)
        fraudList = findViewById(R.id.listFraudAlerts)
        findViewById<TextView>(R.id.buttonAdminEconomyBack).setOnClickListener { finish() }

        val role = resolveCurrentRole()
        val canAccess = UserPermissions.canAccessAnalytics(role)
        Log.d(tag, "Current user rank=$role adminEconomyVisibility=$canAccess")
        if (!canAccess) {
            statusText.text = "Access denied. Admin, Moderator, Junior Developer, and Senior Developer can view this page."
            return
        }

        loadEconomy()
    }

    private fun loadEconomy() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrBlank()) {
            statusText.text = "Session expired. Please log in again."
            return
        }

        statusText.text = "Loading economy data..."
        val auth = "Bearer $token"

        ApiClient.apiService.getAdminEconomySummary(auth)
            .enqueue(object : Callback<EconomySummaryResponse> {
                override fun onResponse(
                    call: Call<EconomySummaryResponse>,
                    response: Response<EconomySummaryResponse>
                ) {
                    Log.d(tag, "economy-summary success=${response.isSuccessful} code=${response.code()}")
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true && body.summary != null) {
                        renderSummary(body.summary)
                        markRequestComplete()
                    } else {
                        markRequestFailed(body?.error ?: "Failed to load economy summary")
                    }
                }

                override fun onFailure(call: Call<EconomySummaryResponse>, t: Throwable) {
                    Log.w(tag, "economy-summary failed: ${t.message}")
                    markRequestFailed("Economy summary unavailable")
                }
            })

        ApiClient.apiService.getAdminTopCreators(auth, limit = 12)
            .enqueue(object : Callback<TopCreatorsResponse> {
                override fun onResponse(
                    call: Call<TopCreatorsResponse>,
                    response: Response<TopCreatorsResponse>
                ) {
                    Log.d(tag, "top-creators success=${response.isSuccessful} code=${response.code()}")
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        renderTopCreators(body.creators.ifEmpty { body.topCreators })
                        markRequestComplete()
                    } else {
                        renderEmptyRow(creatorsList, body?.error ?: "No creator data available")
                        markRequestFailed(body?.error ?: "Failed to load top creators")
                    }
                }

                override fun onFailure(call: Call<TopCreatorsResponse>, t: Throwable) {
                    Log.w(tag, "top-creators failed: ${t.message}")
                    renderEmptyRow(creatorsList, "Top creators unavailable")
                    markRequestFailed("Top creators unavailable")
                }
            })

        ApiClient.apiService.getAdminFraudAlerts(auth, limit = 10)
            .enqueue(object : Callback<FraudAlertsResponse> {
                override fun onResponse(
                    call: Call<FraudAlertsResponse>,
                    response: Response<FraudAlertsResponse>
                ) {
                    Log.d(tag, "fraud-alerts success=${response.isSuccessful} code=${response.code()}")
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        renderFraudAlerts(body)
                        markRequestComplete()
                    } else {
                        renderEmptyRow(fraudList, body?.error ?: "No fraud alerts available")
                        markRequestFailed(body?.error ?: "Failed to load fraud alerts")
                    }
                }

                override fun onFailure(call: Call<FraudAlertsResponse>, t: Throwable) {
                    Log.w(tag, "fraud-alerts failed: ${t.message}")
                    renderEmptyRow(fraudList, "Fraud alerts unavailable")
                    markRequestFailed("Fraud alerts unavailable")
                }
            })
    }

    private fun renderSummary(summary: EconomySummary) {
        cardGrid.removeAllViews()
        addMetricCard("Total Revenue", money(summary.totalRevenue), "Month ${summary.month ?: "current"}")
        addMetricCard("CPM", money(summary.ecpm), "Estimated eCPM")
        addMetricCard("Impressions", whole(summary.totalImpressions), "Ad impressions")
        addMetricCard("Active Users", summary.activeUsers?.let { whole(it) } ?: "Not reported", "Backend field")
        addMetricCard("Reward Pool", money(summary.rewardPool), "25% revenue pool")
        addMetricCard("Eligible YKC", whole(summary.totalEligibleYkc), "Creator reward base")
        addMetricCard("YKC Value", money(summary.ykcValue, 6), "Dynamic payout value")
        addMetricCard("Fill Rate", percent(summary.fillRate), "Ad requests filled")
        addMetricCard("Qualified Views", whole(summary.totalQualifiedViews), "Rewardable views")
        addMetricCard("Monetizable", whole(summary.totalMonetizableOpportunities), "Revenue opportunities")
    }

    private fun renderTopCreators(creators: List<TopCreator>) {
        creatorsList.removeAllViews()
        if (creators.isEmpty()) {
            renderEmptyRow(creatorsList, "No top creators yet.")
            return
        }

        creators.forEachIndexed { index, creator ->
            addListRow(
                creatorsList,
                "${index + 1}. ${creator.username?.takeIf { it.isNotBlank() } ?: "Creator"}",
                "${whole(creator.totalQualifiedViews)} views • ${whole(creator.totalWatchTime)}s watch time",
                "${whole(creator.ykcEarnedThisMonth)} YKC • ${money(creator.estimatedPayout)} est."
            )
        }
    }

    private fun renderFraudAlerts(response: FraudAlertsResponse) {
        fraudList.removeAllViews()
        val logs = response.suspiciousLogs.ifEmpty { response.alerts }
        if (logs.isEmpty() && response.duplicatePatterns.isEmpty()) {
            renderEmptyRow(fraudList, "No active fraud alerts.")
            return
        }

        logs.take(8).forEach { alert ->
            addListRow(
                fraudList,
                alert.userId?.username ?: alert.userId?.walletId ?: "Suspicious activity",
                alert.action ?: "Review activity",
                "${whole(alert.watchDuration)}s watch • ${alert.timestamp ?: "recent"}"
            )
        }

        response.duplicatePatterns.take(4).forEach { pattern ->
            addListRow(
                fraudList,
                "Duplicate view pattern",
                "Count ${pattern.count ?: 0}",
                pattern.lastSeen ?: "recent"
            )
        }
    }

    private fun addMetricCard(title: String, value: String, subtitle: String) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.bg_menu_card)
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }
        card.addView(text(value, 20f, true, R.color.menu_primary_text))
        card.addView(text(title, 12f, true, R.color.menu_accent))
        card.addView(text(subtitle, 11f, false, R.color.menu_secondary_text))

        val params = GridLayout.LayoutParams().apply {
            width = 0
            height = GridLayout.LayoutParams.WRAP_CONTENT
            columnSpec = GridLayout.spec(GridLayout.UNDEFINED, 1f)
            setMargins(dp(4), dp(4), dp(4), dp(4))
        }
        cardGrid.addView(card, params)
    }

    private fun addListRow(parent: LinearLayout, title: String, subtitle: String, value: String) {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.bg_menu_card)
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }

        val copy = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        copy.addView(text(title, 14f, true, R.color.menu_primary_text))
        copy.addView(text(subtitle, 11f, false, R.color.menu_secondary_text))
        row.addView(copy, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(text(value, 12f, true, R.color.menu_accent))

        parent.addView(row, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            bottomMargin = dp(8)
        })
    }

    private fun renderEmptyRow(parent: LinearLayout, message: String) {
        parent.removeAllViews()
        addListRow(parent, message, "No data returned by backend", "")
    }

    private fun text(value: String, size: Float, bold: Boolean, colorRes: Int): TextView {
        return TextView(this).apply {
            text = value
            textSize = size
            setTextColor(ContextCompat.getColor(this@AdminEconomyActivity, colorRes))
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            includeFontPadding = false
            if (size <= 11f) setPadding(0, dp(5), 0, 0)
        }
    }

    private fun markRequestComplete() {
        completedRequests += 1
        updateStatus()
    }

    private fun markRequestFailed(message: String) {
        failedRequests += 1
        Log.w(tag, message)
        updateStatus()
    }

    private fun updateStatus() {
        statusText.text = "Loaded $completedRequests of 3 admin economy sections${if (failedRequests > 0) " • $failedRequests failed" else ""}."
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
                Log.w(tag, "Unable to parse saved role JSON: ${it.message}")
            }
        }
        return TokenManager.getUserRole(this)
    }

    private fun money(value: Double?, maxFractionDigits: Int = 2): String {
        return "$" + NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = maxFractionDigits
        }.format(value ?: 0.0)
    }

    private fun whole(value: Double?): String {
        return NumberFormat.getIntegerInstance(Locale.getDefault()).format((value ?: 0.0).toLong())
    }

    private fun percent(value: Double?): String {
        return NumberFormat.getPercentInstance(Locale.getDefault()).apply {
            maximumFractionDigits = 1
        }.format(value ?: 0.0)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
