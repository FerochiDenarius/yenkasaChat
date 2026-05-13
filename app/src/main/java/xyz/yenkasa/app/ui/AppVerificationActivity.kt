package xyz.yenkasa.app.ui

import android.content.res.ColorStateList
import android.net.Uri
import android.os.Bundle
import android.view.HapticFeedbackConstants
import android.view.View
import android.widget.ImageView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.bumptech.glide.Glide
import com.google.android.material.progressindicator.CircularProgressIndicator
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.PerformanceTotals
import xyz.yenkasa.app.model.PhaseAdvancementResponse
import xyz.yenkasa.app.model.TrackLoginResponse
import xyz.yenkasa.app.model.UserPerformanceMetricsResponse
import xyz.yenkasa.app.model.VerificationDashboard
import xyz.yenkasa.app.model.VerificationMetrics
import xyz.yenkasa.app.model.VerificationProgressResponse
import xyz.yenkasa.app.model.VerificationRequirements
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class AppVerificationActivity : AppCompatActivity() {

    private lateinit var progressBar: ProgressBar
    private lateinit var progressCircle: CircularProgressIndicator
    private lateinit var progressRankBar: ProgressBar
    private lateinit var requirementRows: LinearLayout

    private lateinit var tabVerified: TextView
    private lateinit var tabAdmin: TextView
    private lateinit var tabModerator: TextView

    private lateinit var btnAdvance: TextView

    private lateinit var textStoreName: TextView
    private lateinit var textRankChip: TextView
    private lateinit var textMemberSince: TextView
    private lateinit var textCurrentRank: TextView
    private lateinit var textNextRank: TextView
    private lateinit var textProgressPercent: TextView
    private lateinit var textCurrentPoints: TextView
    private lateinit var textRemainingPoints: TextView
    private lateinit var textRequirementTitle: TextView
    private lateinit var imageVerificationAvatar: ImageView
    private lateinit var imageVerificationShield: ImageView

    private lateinit var textMetricViews: TextView
    private lateinit var textMetricViewsGoal: TextView
    private lateinit var progressMetricViews: ProgressBar
    private lateinit var textMetricComments: TextView
    private lateinit var textMetricCommentsGoal: TextView
    private lateinit var progressMetricComments: ProgressBar
    private lateinit var textMetricFollowing: TextView
    private lateinit var textMetricFollowingGoal: TextView
    private lateinit var progressMetricFollowing: ProgressBar
    private lateinit var textMetricShares: TextView
    private lateinit var textMetricSharesGoal: TextView
    private lateinit var progressMetricShares: ProgressBar

    private var dashboardData: VerificationDashboard? = null
    private var progressOverride: Int? = null
    private var selectedRankTab = 0
    private var userSelectedRankTab = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_app_verification)

        bindViews()
        setupTabClicks()
        loadDashboard()
        trackLoginEvent()
    }

    private fun bindViews() {
        progressBar = findViewById(R.id.progressBarDashboard)
        progressCircle = findViewById(R.id.progressCircle)
        progressRankBar = findViewById(R.id.progressRankBar)
        requirementRows = findViewById(R.id.layoutRequirementRows)

        tabVerified = findViewById(R.id.tabVerified)
        tabAdmin = findViewById(R.id.tabAdmin)
        tabModerator = findViewById(R.id.tabModerator)

        btnAdvance = findViewById(R.id.btnAdvance)
        btnAdvance.setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
            val app = dashboardData?.appVerification
            if (app?.rankingPeriodStatus != "active_phase") {
                Toast.makeText(
                    this,
                    getString(R.string.ranking_prelaunch_copy),
                    Toast.LENGTH_LONG
                ).show()
            } else if (app.progress.allMet) {
                checkPhaseAdvancement()
            } else {
                Toast.makeText(
                    this,
                    "Ranks unlock as you complete the milestones below.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        findViewById<ImageButton>(R.id.btnVerificationBack).setOnClickListener { finish() }
        findViewById<ImageButton>(R.id.btnVerificationInfo).setOnClickListener {
            Toast.makeText(this, "Complete each milestone to unlock the next rank.", Toast.LENGTH_SHORT).show()
        }
        findViewById<TextView>(R.id.btnLearnMoreRanks).setOnClickListener {
            it.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
            Toast.makeText(this, "Account age, comments made, following, posts liked, logins, and rewarded ads move your rank forward.", Toast.LENGTH_LONG).show()
        }

        textStoreName = findViewById(R.id.textVerificationStoreName)
        textRankChip = findViewById(R.id.textVerificationRankChip)
        textMemberSince = findViewById(R.id.textVerificationMemberSince)
        textCurrentRank = findViewById(R.id.textCurrentRank)
        textNextRank = findViewById(R.id.textNextRank)
        textProgressPercent = findViewById(R.id.textProgressPercent)
        textCurrentPoints = findViewById(R.id.textCurrentPoints)
        textRemainingPoints = findViewById(R.id.textRemainingPoints)
        textRequirementTitle = findViewById(R.id.textRequirementTitle)
        imageVerificationAvatar = findViewById(R.id.imageVerificationAvatar)
        imageVerificationShield = findViewById(R.id.imageVerificationShield)

        textMetricViews = findViewById(R.id.textMetricViews)
        textMetricViewsGoal = findViewById(R.id.textMetricViewsGoal)
        progressMetricViews = findViewById(R.id.progressMetricViews)
        textMetricComments = findViewById(R.id.textMetricComments)
        textMetricCommentsGoal = findViewById(R.id.textMetricCommentsGoal)
        progressMetricComments = findViewById(R.id.progressMetricComments)
        textMetricFollowing = findViewById(R.id.textMetricFollowing)
        textMetricFollowingGoal = findViewById(R.id.textMetricFollowingGoal)
        progressMetricFollowing = findViewById(R.id.progressMetricFollowing)
        textMetricShares = findViewById(R.id.textMetricShares)
        textMetricSharesGoal = findViewById(R.id.textMetricSharesGoal)
        progressMetricShares = findViewById(R.id.progressMetricShares)

        tabVerified.text = "Verified"
        tabAdmin.text = "Rising Star"
        tabModerator.text = "Legend"
    }

    private fun authHeader(): String = "Bearer ${TokenManager.getToken(this)}"

    private fun setupTabClicks() {
        listOf(tabVerified, tabAdmin, tabModerator).forEachIndexed { index, tab ->
            tab.setOnClickListener {
                userSelectedRankTab = true
                selectedRankTab = index
                highlightTab(index)
            }
        }
        highlightTab(0)
    }

    private fun highlightTab(index: Int) {
        listOf(tabVerified, tabAdmin, tabModerator).forEachIndexed { tabIndex, tab ->
            val selected = tabIndex == index
            tab.setBackgroundResource(
                if (selected) R.drawable.bg_verification_segment_active else android.R.color.transparent
            )
            tab.setTextColor(
                ContextCompat.getColor(
                    this,
                    if (selected) R.color.on_surface else R.color.wallet_secondary_text
                )
            )
            androidx.core.widget.TextViewCompat.setCompoundDrawableTintList(
                tab,
                ColorStateList.valueOf(
                    ContextCompat.getColor(
                        this,
                        if (selected) R.color.on_surface else R.color.wallet_secondary_text
                    )
                )
            )
            tab.alpha = if (selected) 1f else 0.82f
        }
    }

    private fun loadDashboard() {
        showLoading(true)

        TokenManager.getDashboardCache(this)?.takeIf { it.isNotBlank() }?.let { cachedJson ->
            try {
                val cached = com.google.gson.Gson().fromJson(cachedJson, VerificationDashboard::class.java)
                if (cached != null) {
                    dashboardData = cached
                    renderDashboard()
                    loadPerformanceMetrics()
                    updateAdvancePhaseButton()
                    loadProgress()
                }
            } catch (ex: Exception) {
                ex.printStackTrace()
                TokenManager.saveDashboardCache(this, "")
            }
        }

        ApiClient.apiService.getDashboard(authHeader())
            .enqueue(object : Callback<VerificationDashboard> {
                override fun onResponse(
                    call: Call<VerificationDashboard>,
                    response: Response<VerificationDashboard>
                ) {
                    showLoading(false)

                    if (!response.isSuccessful) {
                        Toast.makeText(this@AppVerificationActivity, "Failed to load dashboard: ${response.code()}", Toast.LENGTH_LONG).show()
                        return
                    }

                    val body = response.body() ?: run {
                        Toast.makeText(this@AppVerificationActivity, "Empty dashboard response", Toast.LENGTH_SHORT).show()
                        return
                    }

                    TokenManager.saveDashboardCache(
                        this@AppVerificationActivity,
                        com.google.gson.Gson().toJson(body)
                    )

                    dashboardData = body
                    renderDashboard()
                    loadPerformanceMetrics()
                    updateAdvancePhaseButton()
                    loadProgress()
                }

                override fun onFailure(call: Call<VerificationDashboard>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(this@AppVerificationActivity, "Network error: ${t.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadProgress() {
        ApiClient.apiService.getProgress(authHeader())
            .enqueue(object : Callback<VerificationProgressResponse> {
                override fun onResponse(
                    call: Call<VerificationProgressResponse>,
                    response: Response<VerificationProgressResponse>
                ) {
                    if (!response.isSuccessful) return
                    val res = response.body() ?: return
                    progressOverride = res.overallProgress.coerceIn(0, 100)
                    copyMetrics(res.currentMetrics, dashboardData?.appVerification?.currentMetrics)
                    renderDashboard()
                }

                override fun onFailure(call: Call<VerificationProgressResponse>, t: Throwable) {
                    t.printStackTrace()
                }
            })
    }

    private fun updateAdvancePhaseButton() {
        val met = dashboardData?.appVerification?.progress?.allMet == true
        btnAdvance.visibility = View.VISIBLE
        btnAdvance.text = if (dashboardData?.appVerification?.rankingPeriodStatus == "active_phase" && met) {
            "Advance"
        } else {
            "View all ranks"
        }
    }

    private fun checkPhaseAdvancement() {
        ApiClient.apiService.checkPhaseAdvancement(authHeader())
            .enqueue(object : Callback<PhaseAdvancementResponse> {
                override fun onResponse(
                    call: Call<PhaseAdvancementResponse>,
                    response: Response<PhaseAdvancementResponse>
                ) {
                    if (!response.isSuccessful) {
                        Toast.makeText(this@AppVerificationActivity, "Server error: ${response.code()}", Toast.LENGTH_LONG).show()
                        return
                    }
                    val res = response.body() ?: run {
                        Toast.makeText(this@AppVerificationActivity, "Empty response", Toast.LENGTH_SHORT).show()
                        return
                    }
                    Toast.makeText(this@AppVerificationActivity, res.message, Toast.LENGTH_LONG).show()
                    loadDashboard()
                }

                override fun onFailure(call: Call<PhaseAdvancementResponse>, t: Throwable) {
                    Toast.makeText(this@AppVerificationActivity, "Network error: ${t.localizedMessage}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun trackLoginEvent() {
        ApiClient.apiService.trackLogin(authHeader())
            .enqueue(object : Callback<TrackLoginResponse> {
                override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) = Unit
                override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                    t.printStackTrace()
                }
            })
    }

    private fun loadPerformanceMetrics() {
        val userId = TokenManager.getUserId(this) ?: return

        ApiClient.apiService.getPerformanceMetrics(
            userId,
            authHeader()
        ).enqueue(object : Callback<UserPerformanceMetricsResponse> {

            override fun onResponse(
                call: Call<UserPerformanceMetricsResponse>,
                response: Response<UserPerformanceMetricsResponse>
            ) {
                if (!response.isSuccessful) return
                val totals = response.body()?.performanceMetrics ?: return
                applyPerformanceTotals(totals, dashboardData?.appVerification?.currentMetrics ?: return)
                renderDashboard()
            }

            override fun onFailure(call: Call<UserPerformanceMetricsResponse>, t: Throwable) {
                t.printStackTrace()
            }
        })
    }

    private fun renderDashboard() {
        val data = dashboardData ?: return
        val app = data.appVerification
        val metrics = app.currentMetrics
        val requirements = app.requirements

        val currentRank = rankLabel(app.currentRank ?: app.currentRankKey, app.currentPhase)
        val nextRank = rankLabel(app.nextRank ?: app.nextRankKey, app.currentPhase).takeIf { it != "Unverified" } ?: "Top Rank"
        val overallProgress = progressOverride ?: app.progressToNextRank ?: calculateOverallProgress(metrics, requirements)

        if (!userSelectedRankTab) {
            selectedRankTab = rankTabForRole(app.currentRank ?: app.currentRankKey)
            highlightTab(selectedRankTab)
        }

        textStoreName.text = TokenManager.getUsername(this)?.takeIf { it.isNotBlank() } ?: "Yenkasa"
        bindAvatar()
        textRankChip.text = currentRank
        textMemberSince.text = buildRankingStatusText(app)
        textCurrentRank.text = currentRank
        textNextRank.text = nextRank
        textRequirementTitle.text = "To reach $nextRank"
        imageVerificationShield.setImageResource(rankBadge(app.currentRank ?: app.currentRankKey))
        textProgressPercent.text = "$overallProgress%"
        progressCircle.setProgressCompat(overallProgress, true)
        progressRankBar.progress = overallProgress

        val currentPoints = currentRequirementPoints(metrics, requirements)
        val targetPoints = targetRequirementPoints(requirements)
        val remaining = (targetPoints - currentPoints).coerceAtLeast(0)
        textCurrentPoints.text = "${formatNumber(currentPoints)} / ${formatNumber(targetPoints)} points"
        textRemainingPoints.text = "${formatNumber(remaining)} points to $nextRank"

        bindMetricCard(
            valueView = textMetricViews,
            goalView = textMetricViewsGoal,
            progressView = progressMetricViews,
            value = metrics.totalViewsReceived,
            goal = 0,
            label = "Views tracked"
        )
        bindMetricCard(
            valueView = textMetricComments,
            goalView = textMetricCommentsGoal,
            progressView = progressMetricComments,
            value = metrics.totalCommentsMade,
            goal = requirements.commentsMade,
            label = "Goal: ${formatNumber(requirements.commentsMade)}"
        )

        bindMetricCard(
            valueView = textMetricFollowing,
            goalView = textMetricFollowingGoal,
            progressView = progressMetricFollowing,
            value = metrics.totalFollowing,
            goal = requirements.following,
            label = "Goal: ${formatNumber(requirements.following)}"
        )

        bindMetricCard(
            valueView = textMetricShares,
            goalView = textMetricSharesGoal,
            progressView = progressMetricShares,
            value = metrics.postsLiked,
            goal = 0,
            label = "Posts liked tracked"
        )

        bindRequirementRows(metrics, requirements)
        updateAdvancePhaseButton()
    }

    private fun bindMetricCard(
        valueView: TextView,
        goalView: TextView,
        progressView: ProgressBar,
        value: Int,
        goal: Int,
        label: String
    ) {
        valueView.text = formatNumber(value)
        goalView.text = label
        progressView.progress = if (goal > 0) percent(value, goal) else if (value > 0) 100 else 0
    }

    private fun bindRequirementRows(metrics: VerificationMetrics, requirements: VerificationRequirements) {
        requirementRows.removeAllViews()

        val rows = listOf(
            RequirementRow("Account Age", "Keep your account active", metrics.accountAge, requirements.accountAge, "days"),
            RequirementRow("Comments Made", "Engage on posts", metrics.totalCommentsMade, requirements.commentsMade, "left"),
            RequirementRow("Following", "Support other users", metrics.totalFollowing, requirements.following, "left"),
            RequirementRow("Posts Liked", "Support posts you enjoy", metrics.postsLiked, requirements.likesGiven, "left"),
            RequirementRow("Daily Logins", "Return daily and stay active", metrics.dailyLogins, requirements.dailyLogins, "left"),
            RequirementRow("Ads Viewed", "Watch rewarded ads", metrics.adsViewed, requirements.adsViewed, "left")
        ) + buildList {
            if (requirements.followers > 0) {
                add(
                    RequirementRow(
                        "Followers",
                        "Passive impact needed for this tier",
                        metrics.totalFollowers,
                        requirements.followers,
                        "left"
                    )
                )
            }
            if (requirements.commentsReceived > 0) {
                add(
                    RequirementRow(
                        "Comments Received",
                        "Your content must attract replies",
                        metrics.totalCommentsReceived,
                        requirements.commentsReceived,
                        "left"
                    )
                )
            }
        }
        rows.forEachIndexed { index, row ->
            requirementRows.addView(createRequirementRow(row))
            if (index != rows.lastIndex) {
                val divider = View(this).apply {
                    setBackgroundColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.wallet_border))
                    alpha = 0.18f
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        dp(1)
                    ).apply {
                        marginStart = dp(42)
                    }
                }
                requirementRows.addView(divider)
            }
        }
    }

    private fun createRequirementRow(row: RequirementRow): View {
        val remaining = (row.target - row.current).coerceAtLeast(0)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(0, dp(10), 0, dp(10))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val icon = TextView(this).apply {
            text = "•"
            textSize = 22f
            gravity = android.view.Gravity.CENTER
            setTextColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.amber_300))
            setBackgroundResource(R.drawable.bg_wallet_pill)
            layoutParams = LinearLayout.LayoutParams(dp(34), dp(34))
        }
        root.addView(icon)

        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = dp(10)
            }
        }

        val title = TextView(this).apply {
            text = row.title
            setTextColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.on_surface))
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        content.addView(title)

        val helper = TextView(this).apply {
            text = row.helper
            setTextColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.wallet_secondary_text))
            textSize = 11f
        }
        content.addView(helper)

        val rowProgress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            progress = percent(row.current, row.target)
            progressDrawable = ContextCompat.getDrawable(
                this@AppVerificationActivity,
                R.drawable.progress_verification_rank
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(4)
            ).apply {
                topMargin = dp(7)
            }
        }
        content.addView(rowProgress)
        root.addView(content)

        val count = TextView(this).apply {
            text = "${formatNumber(row.current)} / ${formatNumber(row.target)}"
            setTextColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.wallet_accent_green))
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.END
            layoutParams = LinearLayout.LayoutParams(dp(82), LinearLayout.LayoutParams.WRAP_CONTENT)
        }
        root.addView(count)

        val badge = TextView(this).apply {
            text = if (remaining == 0) "Done" else "${formatNumber(remaining)} ${row.remainingLabel}"
            setTextColor(ContextCompat.getColor(this@AppVerificationActivity, R.color.amber_300))
            textSize = 11f
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = android.view.Gravity.CENTER
            setBackgroundResource(R.drawable.bg_verification_gold_chip)
            layoutParams = LinearLayout.LayoutParams(dp(76), dp(26)).apply {
                marginStart = dp(8)
            }
        }
        root.addView(badge)

        return root
    }

    private fun copyMetrics(source: VerificationMetrics, target: VerificationMetrics?) {
        if (target == null) return
        target.accountAge = source.accountAge
        target.totalComments = source.totalComments
        target.totalCommentsMade = source.totalCommentsMade
        target.totalFollowers = source.totalFollowers
        target.totalFollowing = source.totalFollowing
        target.maxLikesOnPost = source.maxLikesOnPost
        target.totalLikesCount = source.totalLikesCount
        target.commentLikesReceived = source.commentLikesReceived
        target.dailyLogins = source.dailyLogins
        target.adsViewed = source.adsViewed
        target.postsCreated = source.postsCreated
        target.totalPostCount = source.totalPostCount
        target.totalViewsReceived = source.totalViewsReceived
        target.totalViewsCount = source.totalViewsCount
        target.totalRepliesReceived = source.totalRepliesReceived
        target.totalCommentsReceived = source.totalCommentsReceived
        target.totalShares = source.totalShares
        target.totalLikesReceived = source.totalLikesReceived
        target.postsLiked = source.postsLiked
        target.totalViewsMade = source.totalViewsMade
        target.repliesMade = source.repliesMade
        target.sharesMade = source.sharesMade
        target.profilesVisited = source.profilesVisited
        target.communitiesJoined = source.communitiesJoined
        target.communitiesEngaged = source.communitiesEngaged
        target.reportsMade = source.reportsMade
        target.validReports = source.validReports
    }

    private fun applyPerformanceTotals(totals: PerformanceTotals, metrics: VerificationMetrics) {
        metrics.totalViewsReceived = totals.totalViewsReceived
        metrics.totalLikesReceived = totals.totalLikesReceived
        metrics.totalCommentsReceived = totals.totalCommentsReceived
        metrics.totalRepliesReceived = totals.totalRepliesReceived
        metrics.commentLikesReceived = totals.commentLikesReceived
        metrics.totalShares = totals.totalShares
        metrics.postsCreated = totals.postsCreated
        metrics.totalPostCount = totals.totalPostCount
        metrics.totalViewsCount = totals.totalViewsCount
        metrics.totalLikesCount = totals.totalLikesCount
        metrics.maxLikesOnPost = totals.maxLikesOnPost
        metrics.totalCommentsMade = totals.totalCommentsMade
        metrics.totalFollowers = totals.totalFollowers
        metrics.totalFollowing = totals.totalFollowing
        metrics.postsLiked = totals.postsLiked
        metrics.totalViewsMade = totals.totalViewsMade
        metrics.repliesMade = totals.repliesMade
        metrics.sharesMade = totals.sharesMade
        metrics.profilesVisited = totals.profilesVisited
        metrics.communitiesJoined = totals.communitiesJoined
        metrics.communitiesEngaged = totals.communitiesEngaged
        metrics.reportsMade = totals.reportsMade
        metrics.validReports = totals.validReports
    }

    private fun calculateOverallProgress(metrics: VerificationMetrics, requirements: VerificationRequirements): Int {
        val values = listOf(
            percent(metrics.accountAge, requirements.accountAge),
            percent(metrics.totalCommentsMade, requirements.commentsMade),
            percent(metrics.totalFollowing, requirements.following),
            percent(metrics.postsLiked, requirements.likesGiven),
            percent(metrics.dailyLogins, requirements.dailyLogins),
            percent(metrics.adsViewed, requirements.adsViewed)
        ) + buildList {
            if (requirements.followers > 0) add(percent(metrics.totalFollowers, requirements.followers))
            if (requirements.commentsReceived > 0) add(percent(metrics.totalCommentsReceived, requirements.commentsReceived))
        }
        return values.average().toInt().coerceIn(0, 100)
    }

    private fun currentRequirementPoints(metrics: VerificationMetrics, requirements: VerificationRequirements): Int {
        return listOf(
            metrics.accountAge to requirements.accountAge,
            metrics.totalCommentsMade to requirements.commentsMade,
            metrics.totalFollowing to requirements.following,
            metrics.postsLiked to requirements.likesGiven,
            metrics.dailyLogins to requirements.dailyLogins,
            metrics.adsViewed to requirements.adsViewed
        ).plus(
            listOf(
                metrics.totalFollowers to requirements.followers,
                metrics.totalCommentsReceived to requirements.commentsReceived
            ).filter { it.second > 0 }
        ).sumOf { (current, target) -> current.coerceAtMost(target) }
    }

    private fun targetRequirementPoints(requirements: VerificationRequirements): Int {
        return requirements.accountAge +
            requirements.commentsMade +
                requirements.following +
                requirements.likesGiven +
            requirements.dailyLogins +
            requirements.adsViewed +
            requirements.followers +
            requirements.commentsReceived
    }

    private fun percent(value: Int, target: Int): Int {
        if (target <= 0) return 0
        return ((value.toFloat() / target.toFloat()) * 100f).toInt().coerceIn(0, 100)
    }

    private fun rankLabel(rankKey: String?, phase: Int?): String {
        when (rankKey?.lowercase(Locale.getDefault())) {
            "verified" -> return "Verified"
            "rising_star" -> return "Rising Star"
            "legend" -> return "Legend"
            "admin" -> return "Admin"
            "moderator" -> return "Moderator"
            "junior_developer" -> return "Junior Developer"
            "senior_developer" -> return "Senior Developer"
        }

        return when {
            phase == null || phase <= 1 -> "Unverified"
            else -> "Verified"
        }
    }

    private fun rankBadge(rankKey: String?): Int {
        return when (rankKey?.lowercase(Locale.getDefault())) {
            "moderator" -> R.drawable.badge_moderator
            "admin", "legend" -> R.drawable.badge_admin
            "senior_developer" -> R.drawable.senior_developer_banner
            "junior_developer" -> R.drawable.junior_developer_banner
            else -> R.drawable.badge_verified
        }
    }

    private fun rankTabForRole(rankKey: String?): Int {
        return when (rankKey?.lowercase(Locale.getDefault())) {
            "rising_star" -> 1
            "legend", "admin", "moderator", "junior_developer", "senior_developer" -> 2
            else -> 0
        }
    }

    private fun bindAvatar() {
        val avatarSource = safeAvatarSource(TokenManager.getProfilePicUrl(this))
        if (avatarSource == null) {
            imageVerificationAvatar.setImageResource(R.drawable.ic_yenkasa_logo)
            return
        }

        runCatching {
            Glide.with(this)
                .load(avatarSource)
                .placeholder(R.drawable.ic_yenkasa_logo)
                .error(R.drawable.ic_yenkasa_logo)
                .circleCrop()
                .into(imageVerificationAvatar)
        }.onFailure {
            imageVerificationAvatar.setImageResource(R.drawable.ic_yenkasa_logo)
        }
    }

    private fun safeAvatarSource(rawUrl: String?): Any? {
        val value = rawUrl?.trim()?.takeIf { it.isNotBlank() && it != "null" } ?: return null
        return runCatching {
            val uri = Uri.parse(value)
            val scheme = uri.scheme?.lowercase(Locale.US) ?: return null
            if (scheme in setOf("http", "https", "content", "file")) uri else null
        }.getOrNull()
    }

    private fun buildMemberSinceText(periodLabel: String?, raw: String?): String {
        val memberSince = formatMemberSince(raw)
        return if (periodLabel.isNullOrBlank()) memberSince else "$periodLabel • $memberSince"
    }

    private fun buildRankingStatusText(app: xyz.yenkasa.app.model.AppVerification): String {
        return when (app.rankingPeriodStatus) {
            "pre_launch" -> "Pre-launch ranking period. Official Phase 1 begins on ${formatLaunchDate(app.officialPhaseStartDate ?: app.rankingLaunchDate)}. You can still earn ranks now."
            "active_phase" -> getString(R.string.ranking_active_phase_copy)
            else -> buildMemberSinceText(app.rankingPeriodLabel, app.phaseStartDate)
        }
    }

    private fun formatMemberSince(raw: String?): String {
        val formatted = try {
            if (raw.isNullOrBlank()) {
                null
            } else {
                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                parser.timeZone = TimeZone.getTimeZone("UTC")
                val date = parser.parse(raw)
                date?.let { SimpleDateFormat("MMM yyyy", Locale.getDefault()).format(it) }
            }
        } catch (_: Exception) {
            null
        }

        return formatted?.let { "Member since $it" } ?: "Member since your first login"
    }

    private fun formatLaunchDate(raw: String?): String {
        val formatted = try {
            if (raw.isNullOrBlank()) {
                null
            } else {
                val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                parser.timeZone = TimeZone.getTimeZone("UTC")
                val date = parser.parse(raw)
                date?.let { SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(it) }
            }
        } catch (_: Exception) {
            null
        }

        return formatted ?: "25 May 2026"
    }

    private fun formatNumber(value: Int): String {
        return NumberFormat.getIntegerInstance(Locale.getDefault()).format(value)
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }

    private data class RequirementRow(
        val title: String,
        val helper: String,
        val current: Int,
        val target: Int,
        val remainingLabel: String
    )
}
