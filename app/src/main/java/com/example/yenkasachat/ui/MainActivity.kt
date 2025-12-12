package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.fragment.app.commit
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.util.UserPermissions
import com.google.android.material.floatingactionbutton.FloatingActionButton
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    private lateinit var userId: String
    private lateinit var token: String
    private var currentUser: User? = null
    private lateinit var fabAddPost: FloatingActionButton

    // NEW: toolbar create-ad button
    private lateinit var btnCreateAd: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main) // ✅ links to your activity_main.xml

        // ✅ Setup toolbar
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.title = "Yenkasa"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        toolbar.setNavigationIcon(R.drawable.ic_menu) // ✅ menu icon from drawable folder

        // Handle toolbar menu button click
        toolbar.setNavigationOnClickListener {
            val intent = Intent(this, MenuActivity::class.java)
            startActivity(intent)
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
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        token = retrievedToken
        userId = retrievedUserId

        // ✅ Setup FAB (disabled until user info loads)
        fabAddPost = findViewById(R.id.fabCreatePost)
        fabAddPost.isEnabled = false
        fabAddPost.alpha = 0.5f

        // ✅ Load user info for permissions
        loadUserProfile()
        handleIntentExtras()

        // ✅ Load FeedFragment into the container
        if (savedInstanceState == null) {
            Log.d("MainActivity", "🧩 Loading FeedFragment into container")
            supportFragmentManager.commit {
                replace(R.id.feedContainer, FeedFragment())
            }
        }
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
                        val roleName = user.role?.name ?: "user"
                        val verified = user.verified

                        val userJson = JSONObject().apply {
                            put("_id", user._id)
                            put("username", user.username ?: "")
                            put("role", roleName)
                            put("verified", verified)
                            put("profileImage", user.profileImage ?: "")
                            put("email", user.email ?: "")
                            put("phone", user.phone ?: "")
                            put("community", user.community ?: JSONObject.NULL)
                            put("coinsBalance", user.coinsBalance ?: 0)

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
                    Toast.makeText(
                        this@MainActivity,
                        "Failed to load user profile",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<User>, t: Throwable) {
                Toast.makeText(
                    this@MainActivity,
                    "Error loading profile: ${t.message}",
                    Toast.LENGTH_LONG
                ).show()
            }
        })
    }

    // ==================== FAB Setup with Permission Checks ====================
    private fun setupFab() {
        val user = currentUser
        if (user == null) {
            fabAddPost.isEnabled = false
            fabAddPost.alpha = 0.5f
            return
        }

        val roleName: String? = user.role?.name
        val verified = user.verified

        val canPost = UserPermissions.canPost(roleName, verified)

        fabAddPost.isEnabled = canPost
        fabAddPost.alpha = if (canPost) 1f else 0.5f

        fabAddPost.setOnClickListener {
            when {
                canPost -> {
                    val intent = Intent(this, PostActivity::class.java)
                    intent.putExtra("userId", user._id)
                    startActivity(intent)
                }
                !verified -> {
                    Toast.makeText(
                        this,
                        "Your account must be verified before you can post.",
                        Toast.LENGTH_LONG
                    ).show()
                }
                else -> {
                    Toast.makeText(
                        this,
                        "You do not have permission to post at this time.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    /**
     * Enable/disable and wire up the CREATE-AD toolbar button.
     * Only accessible to owner/admin/sponsor roles (adjust as needed).
     */
    /**
     * Enable/disable and wire up the CREATE-AD toolbar button.
     * For now: ENABLE FOR ALL USERS (testing mode).
     */
    private fun setupCreateAdButton() {
        val user = currentUser
        if (user == null) {
            btnCreateAd.isEnabled = false
            btnCreateAd.alpha = 0.35f
            btnCreateAd.setOnClickListener {
                Toast.makeText(this, "Please wait...", Toast.LENGTH_SHORT).show()
            }
            return
        }

        // 🔥 TEST MODE: allow ALL users to create ads
        val allowed = true   // <--- always allow during testing

        btnCreateAd.isEnabled = true
        btnCreateAd.alpha = 1f

        btnCreateAd.setOnClickListener {
            val intent = Intent(this, CreateAdActivity::class.java)
            startActivity(intent)
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
