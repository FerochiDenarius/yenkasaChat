package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.fragment.app.Fragment
import com.example.yenkasachat.R
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.title = "Yenkasa Feed"

        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        token = retrievedToken
        userId = retrievedUserId

        fabAddPost = findViewById(R.id.btnAddPost)
        fabAddPost.isEnabled = false
        fabAddPost.alpha = 0.5f

        // ✅ Load user profile from API
        loadUserProfile()

        // ✅ Load Feed container fragment
        if (savedInstanceState == null) {
            replaceFragment(FeedContainerFragment())
        }
    }

    // ==================== Load user profile from API ====================
    private fun loadUserProfile() {
        ApiClient.apiService.getUserProfile().enqueue(object : Callback<User> {
            override fun onResponse(call: Call<User>, response: Response<User>) {
                if (response.isSuccessful && response.body() != null) {
                    currentUser = response.body()
                    setupFab()

                    // 🧩 Save/refresh user data locally for offline permission checks
                    try {
                        val user = currentUser!!
                        val userJson = JSONObject().apply {
                            put("_id", user._id)
                            put("username", user.username ?: "")
                            put("role", user.role ?: "user")
                            put("verified", user.verified)
                            put("profileImage", user.profileImage ?: "")
                            put("email", user.email ?: "")
                            put("phone", user.phone ?: "")
                            put("community", user.community ?: JSONObject.NULL)
                            put("coinsBalance", user.coinsBalance)

                            val permissionsJson = JSONObject().apply {
                                put("canPost", user.permissions?.canPost ?: false)
                                put("canApprovePost", user.permissions?.canApprovePost ?: false)
                                put("canRevokeAdmin", user.permissions?.canRevokeAdmin ?: false)
                                put("canSuspendUser", user.permissions?.canSuspendUser ?: false)
                                put("canAssignRoles", user.permissions?.canAssignRoles ?: false)
                            }
                            put("permissions", permissionsJson)
                        }.toString()

                        TokenManager.saveUserJson(this@MainActivity, userJson)
                        Log.i("MainActivity", "🧩 User JSON updated and saved successfully.")
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

        val canPost = user.permissions?.canPost == true && user.verified

        fabAddPost.isEnabled = true
        fabAddPost.alpha = if (canPost) 1f else 0.5f

        fabAddPost.setOnClickListener {
            when {
                canPost -> {
                    val intent = Intent(this, PostActivity::class.java)
                    intent.putExtra("userId", userId)
                    startActivity(intent)
                }

                !user.verified -> {
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

    private fun replaceFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.mainContainer, fragment)
            .commit()
    }

    override fun onCreateOptionsMenu(menu: android.view.Menu?): Boolean {
        menuInflater.inflate(R.menu.toolbar_menu, menu)
        return true
    }

    override fun onOptionsItemSelected(item: android.view.MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_open_menu -> {
                startActivity(Intent(this, MenuActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
