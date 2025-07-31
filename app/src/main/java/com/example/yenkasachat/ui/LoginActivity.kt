package com.example.yenkasachat.ui



import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.ui.semantics.text
import com.example.yenkasachat.R
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.OneSignalHelper
import com.onesignal.OneSignal
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var editIdentifier: EditText
    private lateinit var editPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var textRegisterLink: TextView

    // In LoginActivity.kt
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Auto-login if BOTH token AND userId already exist
        val existingToken = TokenManager.getToken(this)
        val existingUserId = TokenManager.getUserId(this) // Crucial: Check for UserId too!

        Log.d(
            "LoginActivity",
            "🧾 Auto-Login Check - Token: $existingToken, UserID: $existingUserId"
        )

        if (!existingToken.isNullOrEmpty() && !existingUserId.isNullOrEmpty()) {
            Log.d("LoginActivity", "Token and UserID exist. Attempting auto-login to MainActivity.")
            val intent = Intent(this, MainActivity::class.java).apply {
                // Optional: Add flags if you want MainActivity to be a new root
                // flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            finish() // Finish LoginActivity as we are navigating away
            return   // Important: stop further execution of this onCreate
        }

        // If token or userId is missing, proceed to show login screen
        Log.d("LoginActivity", "Token or UserID missing. Displaying login screen.")
        setContentView(R.layout.activity_login)

        editIdentifier = findViewById(R.id.editLoginIdentifier)
        editPassword = findViewById(R.id.editLoginPassword)
        btnLogin = findViewById(R.id.btnLogin)
        textRegisterLink = findViewById(R.id.textRegisterLink)
        val textForgotPassword: TextView = findViewById(R.id.textForgotPassword)

        // OneSignal init
        OneSignal.initWithContext(this)
        OneSignal.setAppId("165df9e6-a0ea-4a37-a40a-110af7e28ad2")

        btnLogin.setOnClickListener { handleLogin() }

        textRegisterLink.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        textForgotPassword.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }
    }

    // In LoginActivity.kt
    private fun handleLogin() {
        val identifier = editIdentifier.text.toString().trim()
        val password = editPassword.text.toString()

        // ... (your input validations for identifier and password remain the same) ...
        if (identifier.isEmpty()) { /* ... */ return
        }
        if (password.isEmpty()) { /* ... */ return
        }
        if (identifier.contains("@") && !android.util.Patterns.EMAIL_ADDRESS.matcher(identifier)
                .matches()
        ) { /* ... */ return
        }

        val request = LoginRequest(identifier, password)
        ApiClient.init(this@LoginActivity) // Consider if this needs to be called every time
        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful) {
                    val loginResponse = response.body()
                    val user = loginResponse?.user
                    val token = loginResponse?.token

                    // Consolidated check for all necessary data
                    if (loginResponse != null && user != null && !user._id.isNullOrEmpty() && !token.isNullOrEmpty()) {

                        TokenManager.saveToken(this@LoginActivity, token)
                        TokenManager.saveUserId(this@LoginActivity, user._id) // Save User ID ONCE

                        Log.d(
                            "LoginActivity",
                            "🔐 Token saved: ${TokenManager.getToken(this@LoginActivity)}"
                        )
                        Log.d(
                            "LoginActivity",
                            "🪪 UserID saved: ${TokenManager.getUserId(this@LoginActivity)}"
                        )

                        ApiClient.init(this@LoginActivity) // Re-init with new token if necessary

                        Log.i("LoginActivity", "✅ Login successful for: ${user.username}")
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT)
                            .show()

                        OneSignalHelper.getPlayerIdAndUpdateToBackend(this@LoginActivity)

                        // Navigate to MainActivity and clear task
                        val intent = Intent(this@LoginActivity, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        }
                        startActivity(intent)
                        finish() // Finish LoginActivity
                    } else {
                        // Handle cases where response is successful but data is incomplete
                        var errorMessage = "Login failed: "
                        if (token.isNullOrEmpty()) {
                            errorMessage += "Missing token from server. "
                            Log.e(
                                "LoginActivity",
                                "❌ Received empty/null token from login response despite successful HTTP status."
                            )
                        }
                        if (user == null || user._id.isNullOrEmpty()) {
                            errorMessage += "Incomplete user info from server."
                            Log.w(
                                "LoginActivity",
                                "⚠️ Login response missing user data or user ID despite successful HTTP status."
                            )
                        }
                        Toast.makeText(this@LoginActivity, errorMessage.trim(), Toast.LENGTH_LONG)
                            .show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    Log.e(
                        "LoginActivity",
                        "❌ Login request failed. Code: ${response.code()}, Message: ${response.message()}, ErrorBody: $errorBody"
                    )
                    Toast.makeText(
                        this@LoginActivity,
                        "Login failed: ${response.message()} (${response.code()})",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                Log.e("LoginActivity", "❌ Network error or other failure: ${t.message}", t)
                Toast.makeText(this@LoginActivity, "Network error: ${t.message}", Toast.LENGTH_LONG)
                    .show()
            }
        })
    }
}