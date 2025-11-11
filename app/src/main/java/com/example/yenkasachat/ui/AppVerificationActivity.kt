package com.example.yenkasachat.ui

import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.example.yenkasachat.R
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class AppVerificationActivity : AppCompatActivity() {

    private lateinit var progressBar: ProgressBar
    private lateinit var textPhase: TextView
    private lateinit var textDaysRemaining: TextView
    private lateinit var textProgress: TextView
    private lateinit var layoutRequirements: LinearLayout
    private lateinit var btnAdvancePhase: Button
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var textRoleBanner: TextView

    private var token: String? = null
    private var userRole: String? = null
    private var developerOverride: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_app_verification)

        supportActionBar?.title = "App Verification"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", null)

        initViews()
        loadDashboard()

        swipeRefresh.setOnRefreshListener { loadDashboard() }

        btnAdvancePhase.setOnClickListener { checkPhaseAdvancement() }
    }

    private fun initViews() {
        progressBar = findViewById(R.id.progressBarVerification)
        textPhase = findViewById(R.id.textPhase)
        textDaysRemaining = findViewById(R.id.textDaysRemaining)
        textProgress = findViewById(R.id.textProgress)
        layoutRequirements = findViewById(R.id.layoutRequirements)
        btnAdvancePhase = findViewById(R.id.btnAdvancePhase)
        swipeRefresh = findViewById(R.id.swipeRefreshVerification)

        // Role banner (add this TextView to your layout XML)
        textRoleBanner = findViewById(R.id.textRoleBanner)
    }

    private fun loadDashboard() {
        showLoading(true)

        ApiClient.apiService.getVerificationDashboard("Bearer $token")
            .enqueue(object : Callback<VerificationDashboard> {
                override fun onResponse(
                    call: Call<VerificationDashboard>,
                    response: Response<VerificationDashboard>
                ) {
                    showLoading(false)
                    swipeRefresh.isRefreshing = false

                    if (response.isSuccessful && response.body() != null) {
                        val dashboard = response.body()!!
                        userRole = dashboard.userRole?.lowercase()
                        developerOverride = dashboard.developerOverride ?: false
                        displayDashboard(dashboard)
                    } else {
                        Toast.makeText(
                            this@AppVerificationActivity,
                            "Failed to load dashboard",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<VerificationDashboard>, t: Throwable) {
                    showLoading(false)
                    swipeRefresh.isRefreshing = false
                    Toast.makeText(
                        this@AppVerificationActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun displayDashboard(data: VerificationDashboard) {
        val appVer = data.appVerification
        val role = userRole ?: "user"
        val isDeveloper = role.contains("developer")
        val isSeniorDev = role.contains("senior")
        val isModerator = role == "moderator"
        val isAdmin = role == "admin"

        // 🟦 Display user role at top
        val roleText = when {
            isSeniorDev -> "👑 Senior Developer (Verification Override Enabled)"
            isDeveloper -> "🧑‍💻 Developer (Override Active: $developerOverride)"
            isModerator -> "🛡️ Moderator"
            isAdmin -> "⚙️ Admin"
            else -> "🔹 Verified User"
        }
        textRoleBanner.text = roleText
        textRoleBanner.visibility = View.VISIBLE

        textPhase.text = "Phase ${appVer.currentPhase}"
        textDaysRemaining.text = "Days remaining: ${appVer.daysRemaining}"

        layoutRequirements.removeAllViews()

        val reqs = appVer.requirements
        val metrics = appVer.currentMetrics
        var roleMultiplier = reqs.roleMultiplier ?: 1.0f

        // 🧮 Adjust multipliers based on role
        roleMultiplier = when {
            isModerator -> 1.8f
            isAdmin -> 1.0f
            else -> roleMultiplier
        }

        val scaledReqs = reqs.copy(
            accountAge = (reqs.accountAge * roleMultiplier).toInt(),
            comments = (reqs.comments * roleMultiplier).toInt(),
            followers = (reqs.followers * roleMultiplier).toInt(),
            maxLikes = (reqs.maxLikes * roleMultiplier).toInt(),
            dailyLogins = (reqs.dailyLogins * roleMultiplier).toInt(),
            adsViewed = (reqs.adsViewed * roleMultiplier).toInt()
        )

        // 🧠 Developer override: bypass requirements if developerOverride = true or senior dev
        val allMet = if (isSeniorDev || developerOverride) {
            true
        } else appVer.progress.allMet

        addRequirementView("Account Age", metrics.accountAge, scaledReqs.accountAge, appVer.progress.accountAge)
        addRequirementView("Comments", metrics.totalComments, scaledReqs.comments, appVer.progress.comments)
        addRequirementView("Followers", metrics.totalFollowers, scaledReqs.followers, appVer.progress.followers)
        addRequirementView("Max Likes", metrics.maxLikesOnPost, scaledReqs.maxLikes, appVer.progress.maxLikes)
        addRequirementView("Daily Logins", metrics.dailyLogins, scaledReqs.dailyLogins, appVer.progress.dailyLogins)
        addRequirementView("Ads Viewed", metrics.adsViewed, scaledReqs.adsViewed, appVer.progress.adsViewed)

        textProgress.text = when {
            isSeniorDev -> "✅ Senior Developer: Verification automatically approved."
            developerOverride -> "🧑‍💻 Developer override active — verification not required."
            allMet -> "✅ All requirements met! You can advance your phase."
            else -> "Progress ongoing..."
        }

        btnAdvancePhase.isEnabled = allMet
    }

    private fun addRequirementView(
        title: String,
        current: Int,
        required: Int,
        achieved: Boolean
    ) {
        val view = layoutInflater.inflate(
            R.layout.item_requirement_progress,
            layoutRequirements,
            false
        )
        val textTitle = view.findViewById<TextView>(R.id.textRequirementTitle)
        val textValue = view.findViewById<TextView>(R.id.textRequirementValue)
        val iconStatus = view.findViewById<ImageView>(R.id.iconRequirementStatus)

        textTitle.text = title
        textValue.text = "$current / $required"
        val iconRes = if (achieved) R.drawable.ic_check_circle else R.drawable.ic_circle_outline
        val tintColor = if (achieved)
            ContextCompat.getColor(this, R.color.green)
        else
            ContextCompat.getColor(this, R.color.gray_dark)

        iconStatus.setImageResource(iconRes)
        iconStatus.setColorFilter(tintColor)

        layoutRequirements.addView(view)
    }

    private fun checkPhaseAdvancement() {
        showLoading(true)
        ApiClient.apiService.checkPhaseAdvancement("Bearer $token")
            .enqueue(object : Callback<PhaseAdvancementResponse> {
                override fun onResponse(
                    call: Call<PhaseAdvancementResponse>,
                    response: Response<PhaseAdvancementResponse>
                ) {
                    showLoading(false)
                    if (response.isSuccessful && response.body() != null) {
                        val res = response.body()!!
                        Toast.makeText(
                            this@AppVerificationActivity,
                            res.message,
                            Toast.LENGTH_LONG
                        ).show()
                        loadDashboard()
                    } else {
                        Toast.makeText(
                            this@AppVerificationActivity,
                            "Unable to check phase advancement",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<PhaseAdvancementResponse>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(
                        this@AppVerificationActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
