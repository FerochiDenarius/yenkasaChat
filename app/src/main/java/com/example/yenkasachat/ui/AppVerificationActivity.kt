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


    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_app_verification)

        supportActionBar?.title = "App Verification"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        // Get token
        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", null)

        initViews()
        loadDashboard()

        swipeRefresh.setOnRefreshListener {
            loadDashboard()
        }

        btnAdvancePhase.setOnClickListener {
            checkPhaseAdvancement()
        }
    }

    private fun initViews() {
        progressBar = findViewById(R.id.progressBarVerification)
        textPhase = findViewById(R.id.textPhase)
        textDaysRemaining = findViewById(R.id.textDaysRemaining)
        textProgress = findViewById(R.id.textProgress)
        layoutRequirements = findViewById(R.id.layoutRequirements)
        btnAdvancePhase = findViewById(R.id.btnAdvancePhase)
        swipeRefresh = findViewById(R.id.swipeRefreshVerification)
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
                        displayDashboard(dashboard)
                    } else {
                        Toast.makeText(this@AppVerificationActivity, "Failed to load dashboard", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<VerificationDashboard>, t: Throwable) {
                    showLoading(false)
                    swipeRefresh.isRefreshing = false
                    Toast.makeText(this@AppVerificationActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun displayDashboard(data: VerificationDashboard) {
        val appVer = data.appVerification

        textPhase.text = "Phase ${appVer.currentPhase}"
        textDaysRemaining.text = "Days remaining: ${appVer.daysRemaining}"

        // Show requirement progress
        layoutRequirements.removeAllViews()

        val reqs = appVer.requirements
        val metrics = appVer.currentMetrics

        addRequirementView("Account Age", metrics.accountAge, reqs.accountAge, appVer.progress.accountAge)
        addRequirementView("Comments", metrics.totalComments, reqs.comments, appVer.progress.comments)
        addRequirementView("Followers", metrics.totalFollowers, reqs.followers, appVer.progress.followers)
        addRequirementView("Max Likes", metrics.maxLikesOnPost, reqs.maxLikes, appVer.progress.maxLikes)
        addRequirementView("Daily Logins", metrics.dailyLogins, reqs.dailyLogins, appVer.progress.dailyLogins)
        addRequirementView("Ads Viewed", metrics.adsViewed, reqs.adsViewed, appVer.progress.adsViewed)

        textProgress.text = if (appVer.progress.allMet)
            "✅ All requirements met! You can advance your phase."
        else
            "Progress ongoing..."

        btnAdvancePhase.isEnabled = appVer.progress.allMet
    }

    private fun addRequirementView(
        title: String,
        current: Int,
        required: Int,
        achieved: Boolean
    ) {
        val view = layoutInflater.inflate(R.layout.item_requirement_progress, layoutRequirements, false)
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
                        Toast.makeText(this@AppVerificationActivity, res.message, Toast.LENGTH_LONG).show()
                        loadDashboard()
                    } else {
                        Toast.makeText(this@AppVerificationActivity, "Unable to check phase advancement", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<PhaseAdvancementResponse>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(this@AppVerificationActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
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
