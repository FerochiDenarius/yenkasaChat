package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.network.ApiClient
import com.onesignal.OneSignal
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var editIdentifier: EditText
    private lateinit var editPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var textRegisterLink: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        val token = prefs.getString("token", null)

        if (!token.isNullOrEmpty()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_login)

        editIdentifier = findViewById(R.id.editLoginIdentifier)
        editPassword = findViewById(R.id.editLoginPassword)
        btnLogin = findViewById(R.id.btnLogin)
        textRegisterLink = findViewById(R.id.textRegisterLink)

        // ✅ Initialize OneSignal here (best placed in Application class ideally)
        OneSignal.initWithContext(this)
        OneSignal.setAppId("165df9e6-a0ea-4a37-a40a-110af7e28ad2")
        Log.d("OneSignal", "🔄 Initialized OneSignal in LoginActivity")

        btnLogin.setOnClickListener {
            Log.d("LoginDebug", "Login button clicked")
            handleLogin()
        }

        textRegisterLink.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }
    }

    private fun handleLogin() {
        val identifier = editIdentifier.text.toString().trim()
        val password = editPassword.text.toString()

        if (identifier.isEmpty()) {
            editIdentifier.error = "Phone, email or username is required"
            return
        }

        if (password.isEmpty()) {
            editPassword.error = "Password is required"
            return
        }

        if (identifier.contains("@") &&
            !android.util.Patterns.EMAIL_ADDRESS.matcher(identifier).matches()) {
            editIdentifier.error = "Invalid email format"
            return
        }

        val request = LoginRequest(identifier, password)
        Log.d("LoginDebug", "Attempting login with: $identifier")

        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful) {
                    val loginResponse = response.body()
                    if (loginResponse != null) {
                        // ✅ Save user info and token
                        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("userId", loginResponse.user._id)
                            .putString("token", loginResponse.token)
                            .putString("username", loginResponse.user.username)
                            .putString("email", loginResponse.user.email ?: "")
                            .putString("phone", loginResponse.user.phone ?: "")
                            .putString("location", loginResponse.user.location ?: "")
                            .putBoolean("verified", loginResponse.user.verified)
                            .apply()

                        Log.d("LoginSuccess", "Login OK: ${loginResponse.user.username}")
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()

                        // ✅ Fetch Player ID safely (delayed if not ready)
                        fetchAndUploadPlayerId(loginResponse.user._id)

                        // ✅ Go to main screen
                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        Toast.makeText(this@LoginActivity, "Unexpected server response", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val errorMsg = try {
                        response.errorBody()?.string() ?: "Unknown error"
                    } catch (e: Exception) {
                        "Unknown error"
                    }
                    Log.e("LoginDebug", "Login failed: ${response.code()} $errorMsg")
                    Toast.makeText(this@LoginActivity, "Invalid credentials", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                Log.e("LoginDebug", "Network error: ${t.message}")
                Toast.makeText(this@LoginActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // ✅ Reliable OneSignal Player ID fetching
    private fun fetchAndUploadPlayerId(userId: String) {
        val deviceState = OneSignal.getDeviceState()
        val playerId = deviceState?.userId

        if (!playerId.isNullOrEmpty()) {
            Log.d("OneSignal", "✅ Player ID: $playerId")
            ApiClient.authService.updatePlayerId(
                userId,
                mapOf("playerId" to playerId)
            ).enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    Log.d("OneSignal", "📤 Player ID uploaded: ${response.code()}")
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Log.e("OneSignal", "❌ Failed to upload Player ID: ${t.message}")
                }
            })
        } else {
            Log.w("OneSignal", "⚠️ Player ID not ready yet, retrying in 2 seconds...")
            // Retry after 2s
            editPassword.postDelayed({
                fetchAndUploadPlayerId(userId)
            }, 2000)
        }
    }
}
