package xyz.yenkasa.app.ui

import android.content.Intent
import android.content.res.Configuration
import android.graphics.Rect
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
import androidx.fragment.app.commit
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UpdateManager
import xyz.yenkasa.app.util.UserPermissions
import com.google.android.material.floatingactionbutton.FloatingActionButton
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import kotlin.math.roundToInt

class MainActivity : AppCompatActivity() {

    private lateinit var userId: String
    private lateinit var token: String
    private var currentUser: User? = null
    private lateinit var fabAddPost: FloatingActionButton
    private var createFabSafeRightInset: Int = 0

    // NEW: toolbar create-ad button
    private lateinit var btnCreateAd: LinearLayout
    private lateinit var btnMenu: ImageView
    private lateinit var btnNotifications: ImageView
    private lateinit var updateManager: UpdateManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        androidx.core.view.WindowCompat.setDecorFitsSystemWindows(window, false)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        updateManager = UpdateManager(this)
        updateManager.checkForUpdates(
            forceCheck = intent.getBooleanExtra(EXTRA_CHECK_UPDATES_AFTER_LOGIN, false),
            source = if (intent.getBooleanExtra(EXTRA_CHECK_UPDATES_AFTER_LOGIN, false)) "after_login" else "main_launch"
        )

        applySystemBarSpacing()

        // ✅ Setup toolbar
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.title = getString(R.string.yenkasa_brand)
        supportActionBar?.setDisplayHomeAsUpEnabled(false)
        toolbar.navigationIcon = null

        btnMenu = findViewById(R.id.btnMenu)
        btnNotifications = findViewById(R.id.btnNotifications)
        btnMenu.setOnClickListener { startActivity(Intent(this, MenuActivity::class.java)) }
        btnNotifications.setOnClickListener {
            startActivity(Intent(this, UserNotificationsActivity::class.java))
        }

        // FIND/Create-Ad toolbar button (declared in your toolbar XML)
        btnCreateAd = findViewById(R.id.btnCreateAd)
        // default disabled until we know permissions
        btnCreateAd.isEnabled = false
        btnCreateAd.alpha = 0.35f

        // ✅ Retrieve auth info
        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        Log.d("MainActivity", "🔑 Token: ${retrievedToken?.take(10)}...")
        Log.d("MainActivity", "👤 UserId: $retrievedUserId")

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Toast.makeText(this, getString(R.string.please_log_in_again), Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        token = retrievedToken
        userId = retrievedUserId

        // ✅ Setup FAB immediately; backend enforces posting limits.
        fabAddPost = findViewById(R.id.fabCreatePost)
        fabAddPost.isEnabled = true
        fabAddPost.alpha = 1f
        fabAddPost.setOnClickListener {
            val intent = Intent(this, PostActivity::class.java)
            intent.putExtra("userId", userId)
            startActivity(intent)
        }

        // ✅ Load user info for permissions
        loadUserProfile()

        // ✅ Clear container and load FeedFragment into the container if not already handled
        if (savedInstanceState == null) {
            val openFragment = intent.getStringExtra("openFragment")
            if (openFragment != "feed") {
                Log.d("MainActivity", "🧩 Loading default FeedFragment into container")
                supportFragmentManager.commit {
                    replace(R.id.feedContainer, FeedFragment())
                }
            } else {
                handleIntentExtras()
            }
        }
    }


    override fun onResume() {
        super.onResume()
        if (::updateManager.isInitialized) {
            updateManager.completeUpdateIfDownloaded()
            updateManager.checkForUpdates(source = "foreground")
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (::updateManager.isInitialized && updateManager.onActivityResult(requestCode, resultCode)) {
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        if (::updateManager.isInitialized) {
            updateManager.destroy()
        }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_CHECK_UPDATES_AFTER_LOGIN = "check_updates_after_login"
    }

    private fun applySystemBarSpacing() {
        val appBar = findViewById<View>(R.id.mainAppBar)
        val fabLive = findViewById<View>(R.id.btnYenkasaLive)
        val fabPost = findViewById<View>(R.id.fabCreatePost)
        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

        EdgeToEdgeInsets.setLightSystemBars(
            window = window,
            lightStatusBars = !isNightMode,
            lightNavigationBars = !isNightMode
        )
        EdgeToEdgeInsets.applySystemBarPadding(appBar, top = true)
        EdgeToEdgeInsets.applySystemBarMargins(fabLive, right = true, bottom = true)
        applyCreatePostFabInsets(fabPost)
    }

    private fun applyCreatePostFabInsets(fabPost: View) {
        val initialParams = fabPost.layoutParams as? ViewGroup.MarginLayoutParams
        val initialRight = initialParams?.rightMargin ?: 0
        val initialBottom = initialParams?.bottomMargin ?: 0

        ViewCompat.setOnApplyWindowInsetsListener(fabPost) { target, insets ->
            val safeBars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            createFabSafeRightInset = safeBars.right
            target.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                rightMargin = initialRight + safeBars.right
                bottomMargin = initialBottom + safeBars.bottom
            }
            target.post { resolveCreatePostFabCollision(target) }
            insets
        }
        fabPost.addOnLayoutChangeListener { target, _, _, _, _, _, _, _, _ ->
            target.post { resolveCreatePostFabCollision(target) }
        }
        ViewCompat.requestApplyInsets(fabPost)
    }

    private fun resolveCreatePostFabCollision(fabPost: View) {
        if (!fabPost.isShown || fabPost.width == 0) return

        val parent = fabPost.parent as? View ?: return
        val parentRect = Rect()
        val fabRect = Rect()
        if (!parent.getGlobalVisibleRect(parentRect) || !fabPost.getGlobalVisibleRect(fabRect)) return

        val edgeGap = dp(8)
        val collisionGap = dp(8)
        val baseShiftRight = dp(20)
        val currentShift = fabPost.translationX.roundToInt()
        val unshiftedRight = fabRect.right - currentShift
        val maxRightShift = (parentRect.right - createFabSafeRightInset - edgeGap - unshiftedRight)
            .coerceAtLeast(0)
        var desiredShift = baseShiftRight.coerceAtMost(maxRightShift)

        val muteButton = parent.rootView.findViewById<View>(R.id.buttonPlayerMute)
        val muteRect = Rect()
        if (muteButton?.isShown == true && muteButton.getGlobalVisibleRect(muteRect)) {
            val shiftedFabRect = Rect(fabRect).apply {
                offset(desiredShift - currentShift, 0)
            }
            if (Rect.intersects(shiftedFabRect, muteRect)) {
                val extraShift = (muteRect.right + collisionGap - shiftedFabRect.left).coerceAtLeast(0)
                desiredShift = (desiredShift + extraShift).coerceAtMost(maxRightShift)
            }
        }

        if (desiredShift < baseShiftRight && Rect.intersects(fabRect, muteRect) && fabPost is FloatingActionButton) {
            val compactSize = dp(40)
            if (fabPost.customSize != compactSize) {
                fabPost.customSize = compactSize
                fabPost.post { resolveCreatePostFabCollision(fabPost) }
            }
        }

        fabPost.translationX = desiredShift.toFloat()
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).roundToInt()
    }

    // ==================== Load user profile from API ====================
    private fun loadUserProfile() {
        ApiClient.apiService.getUserProfile().enqueue(object : Callback<User> {
            override fun onResponse(call: Call<User>, response: Response<User>) {
                if (response.isSuccessful && response.body() != null) {
                    currentUser = response.body()
                    setupFab()

                    // IMPORTANT: setup the create-ad button now that we have currentUser
                    setupCreateAdButton()

                    try {
                        val user = currentUser!!
                        val roleName = user.role?.name ?: user.roleName ?: if (user.verified) "verified" else "unverified"
                        val verified = user.verified

                        val userJson = JSONObject().apply {
                            put("_id", user._id)
                            put("username", user.username ?: "")
                            put("role", roleName)
                            put("roleName", roleName)
                            put("verified", verified)
                            put("profileImage", user.profileImage ?: "")
                            put("email", user.email ?: "")
                            put("phone", user.phone ?: "")
                            put("community", user.community ?: JSONObject.NULL)
                            put("coinsBalance", user.resolvedCoinsBalance())
                            put("suspendedUntil", user.suspendedUntil ?: JSONObject.NULL)

                            put("role", roleName)
                            val permissionsJson = JSONObject().apply {
                                put("canPost", UserPermissions.canPost(roleName, verified))
                                put("canApprovePost", UserPermissions.canApprove(roleName))
                                put("canRevokeAdmin", UserPermissions.canRevoke(roleName))
                                put("canSuspendUser", UserPermissions.canSuspend(roleName))
                                put("canAssignRoles", UserPermissions.canAssignRoles(roleName))
                            }
                            put("permissions", permissionsJson)
                            put("permissions", permissionsJson)
                        }.toString()

                        TokenManager.saveUserJson(this@MainActivity, userJson)
                        Log.i("MainActivity", "✅ User JSON updated and saved successfully.")
                    } catch (e: Exception) {
                        Log.e("MainActivity", "💥 Failed to save user JSON: ${e.message}", e)
                    }
                } else {
                    setupFab()
                    Toast.makeText(
                        this@MainActivity,
                        getString(R.string.failed_to_load_user_profile),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<User>, t: Throwable) {
                setupFab()
                Toast.makeText(
                    this@MainActivity,
                    getString(R.string.error_loading_profile, t.message ?: ""),
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    // ==================== FAB Setup ====================
    private fun setupFab() {
        val user = currentUser
        if (user == null) {
            fabAddPost.isEnabled = true
            fabAddPost.alpha = 1f
            fabAddPost.setOnClickListener {
                val intent = Intent(this, PostActivity::class.java)
                intent.putExtra("userId", userId)
                startActivity(intent)
            }
            return
        }

        fabAddPost.isEnabled = true
        fabAddPost.alpha = 1f

        fabAddPost.setOnClickListener {
            val intent = Intent(this, PostActivity::class.java)
            intent.putExtra("userId", user._id)
            startActivity(intent)
        }
    }

    /**
     * Enable/disable and wire up the CREATE-AD toolbar button.
     * Verified users and reviewer roles can create sponsored ads.
     */
    private fun setupCreateAdButton() {
        val user = currentUser
        if (user == null) {
            btnCreateAd.isEnabled = false
            btnCreateAd.alpha = 0.35f
            btnCreateAd.setOnClickListener {
                Toast.makeText(this, getString(R.string.please_wait), Toast.LENGTH_SHORT).show()
            }
            return
        }

        val roleName = user.role?.name ?: user.roleName ?: TokenManager.getUserRole(this)
        val allowed = user.verified || UserPermissions.canCreateAd(roleName)

        btnCreateAd.isEnabled = true
        btnCreateAd.alpha = if (allowed) 1f else 0.55f

        btnCreateAd.setOnClickListener {
            if (allowed) {
                startActivity(Intent(this, CreateAdActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    getString(R.string.create_ads_requires_verified),
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun handleIntentExtras() {
        val communityId = intent.getStringExtra("communityId")
        val communityName = intent.getStringExtra("communityName")
        val openFragment = intent.getStringExtra("openFragment")

        if (openFragment == "feed" && communityId != null) {
            val bundle = Bundle().apply {
                putString("communityId", communityId)
                putString("communityName", communityName)
            }

            val feedFragment = FeedFragment().apply {
                arguments = bundle
            }

            supportFragmentManager.commit {
                replace(R.id.feedContainer, feedFragment)
            }
        }
    }
}
