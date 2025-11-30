package com.example.yenkasachat.ui

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.viewpager2.widget.ViewPager2
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MetricsPagerAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.progressindicator.CircularProgressIndicator
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class AppVerificationActivity : AppCompatActivity() {

    private lateinit var progressBar: ProgressBar
    private lateinit var progressCircle: CircularProgressIndicator
    private lateinit var viewPager: ViewPager2

    private lateinit var tabVerified: TextView
    private lateinit var tabAdmin: TextView
    private lateinit var tabModerator: TextView
    private lateinit var tabTotal: TextView

    private lateinit var btnAdvance: Button

    private var dashboardData: VerificationDashboard? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_app_verification)

        supportActionBar?.title = "Verification Dashboard"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        // INIT VIEWS
        progressBar = findViewById(R.id.progressBarDashboard)
        progressCircle = findViewById(R.id.progressCircle)
        viewPager = findViewById(R.id.viewPager)

        tabVerified = findViewById(R.id.tabVerified)
        tabAdmin = findViewById(R.id.tabAdmin)
        tabModerator = findViewById(R.id.tabModerator)
        tabTotal = findViewById(R.id.tabTotalMetrics)

        btnAdvance = findViewById(R.id.btnAdvance)

        setupTabClicks()
        setupViewPagerListener()
        loadDashboard()
        trackLoginEvent()

        btnAdvance.setOnClickListener {
            it.performHapticFeedback(android.view.HapticFeedbackConstants.CONTEXT_CLICK)
            checkPhaseAdvancement()
        }
    }

    // -------------------------------------------------------------
    // TAB SYSTEM
    // -------------------------------------------------------------

    private fun setupTabClicks() {
        tabVerified.setOnClickListener { viewPager.currentItem = 0; highlightTab(0) }
        tabAdmin.setOnClickListener { viewPager.currentItem = 1; highlightTab(1) }
        tabModerator.setOnClickListener { viewPager.currentItem = 2; highlightTab(2) }
        tabTotal.setOnClickListener { viewPager.currentItem = 3; highlightTab(3) }
    }

    private fun setupViewPagerListener() {
        viewPager.registerOnPageChangeCallback(object : ViewPager2.OnPageChangeCallback() {
            override fun onPageSelected(position: Int) {
                highlightTab(position)
            }
        })
    }

    private fun highlightTab(index: Int) {
        resetTabStyles()

        when (index) {
            0 -> activateTab(tabVerified)
            1 -> activateTab(tabAdmin)
            2 -> activateTab(tabModerator)
            3 -> activateTab(tabTotal)
        }
    }

    private fun resetTabStyles() {
        val emerald = ContextCompat.getColor(this, R.color.emerald)
        listOf(tabVerified, tabAdmin, tabModerator, tabTotal).forEach { tab ->
            tab.background = null
            tab.setTextColor(emerald)
            tab.scaleX = 1f
            tab.scaleY = 1f
        }
    }

    private fun activateTab(tab: TextView) {
        tab.setBackgroundResource(R.drawable.bg_tab_active)
        tab.setTextColor(ContextCompat.getColor(this, R.color.amber_300))

        tab.animate()
            .scaleX(1.08f)
            .scaleY(1.08f)
            .setDuration(150)
            .withEndAction {
                tab.animate().scaleX(1f).scaleY(1f).duration = 150
            }
            .start()

        tab.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
    }

    // -------------------------------------------------------------
    // DASHBOARD LOADING + CACHE FIXED
    // -------------------------------------------------------------

    private fun loadDashboard() {
        showLoading(true)

        // 1️⃣ LOAD CACHED DASHBOARD FIRST
        TokenManager.getDashboardCache(this)?.let { cachedJson ->
            try {
                val cached = com.google.gson.Gson().fromJson(cachedJson, VerificationDashboard::class.java)
                if (cached != null) {
                    dashboardData = cached
                    setupViewPager()
                    highlightTab(0)
                    updateAdvancePhaseButton()
                    loadProgress()
                }
            } catch (_: Exception) {}
        }

        // 2️⃣ FETCH FRESH DASHBOARD
        ApiClient.apiService.getDashboard()
            .enqueue(object : Callback<VerificationDashboard> {
                override fun onResponse(
                    call: Call<VerificationDashboard>,
                    response: Response<VerificationDashboard>
                ) {
                    showLoading(false)

                    val body = response.body() ?: return

                    // Save to cache
                    TokenManager.saveDashboardCache(
                        this@AppVerificationActivity,
                        com.google.gson.Gson().toJson(body)
                    )

                    dashboardData = body
                    setupViewPager()
                    highlightTab(0)
                    updateAdvancePhaseButton()
                    loadProgress()
                }

                override fun onFailure(call: Call<VerificationDashboard>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(this@AppVerificationActivity, t.message, Toast.LENGTH_SHORT).show()
                }
            })
    }

    // -------------------------------------------------------------
    // VIEWPAGER SETUP
    // -------------------------------------------------------------

    private fun setupViewPager() {
        val data = dashboardData ?: return
        viewPager.adapter = MetricsPagerAdapter(this, data)
        viewPager.offscreenPageLimit = 4
    }

    // -------------------------------------------------------------
    // PROGRESS LOADING
    // -------------------------------------------------------------

    private fun loadProgress() {
        ApiClient.apiService.getProgress()
            .enqueue(object : Callback<VerificationProgressResponse> {
                override fun onResponse(
                    call: Call<VerificationProgressResponse>,
                    response: Response<VerificationProgressResponse>
                ) {
                    val res = response.body() ?: return
                    progressCircle.visibility = View.VISIBLE
                    progressCircle.setProgressCompat(res.overallProgress, true)
                }

                override fun onFailure(call: Call<VerificationProgressResponse>, t: Throwable) {}
            })
    }

    private fun updateAdvancePhaseButton() {
        val met = dashboardData?.appVerification?.progress?.allMet == true
        btnAdvance.visibility = if (met) View.VISIBLE else View.GONE
    }

    // -------------------------------------------------------------
    // ADVANCE PHASE
    // -------------------------------------------------------------

    private fun checkPhaseAdvancement() {
        ApiClient.apiService.checkPhase()
            .enqueue(object : Callback<PhaseAdvancementResponse> {
                override fun onResponse(
                    call: Call<PhaseAdvancementResponse>,
                    response: Response<PhaseAdvancementResponse>
                ) {
                    val res = response.body() ?: return
                    Toast.makeText(this@AppVerificationActivity, res.message, Toast.LENGTH_LONG).show()
                    loadDashboard()
                }

                override fun onFailure(call: Call<PhaseAdvancementResponse>, t: Throwable) {
                    Toast.makeText(this@AppVerificationActivity, t.message, Toast.LENGTH_SHORT).show()
                }
            })
    }

    // -------------------------------------------------------------
    // LOGIN TRACKING
    // -------------------------------------------------------------

    private fun trackLoginEvent() {
        ApiClient.apiService.trackLogin()
            .enqueue(object : Callback<TrackLoginResponse> {
                override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) {}
                override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {}
            })
    }

    // -------------------------------------------------------------

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }

    override fun onSupportNavigateUp(): Boolean {
        onBackPressedDispatcher.onBackPressed()
        return true
    }
}
