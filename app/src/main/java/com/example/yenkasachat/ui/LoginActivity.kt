package com.example.yenkasachat.ui


import com.example.yenkasachat.util.SharedPrefs
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)



        // Auto-login if token already exists
        val token = SharedPrefs.getToken(this)
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
        val textForgotPassword: TextView = findViewById(R.id.textForgotPassword) // ✅

        // ✅ OneSignal init
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
            !android.util.Patterns.EMAIL_ADDRESS.matcher(identifier).matches()
        ) {
            editIdentifier.error = "Invalid email format"
            return
        }

        val request = LoginRequest(identifier, password)

        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful) {
                    val loginResponse = response.body()

                    TokenManager.saveToken(this@LoginActivity, loginResponse?.token ?: "")
                    ApiClient.init(this@LoginActivity)

                    val user = loginResponse?.user
                    if (response.isSuccessful) {
                        val token = response.body()?.token
                        TokenManager.saveToken(this@LoginActivity, token ?: "")
                        ApiClient.init(this@LoginActivity) // ✅ MUST be after saving token

                        // Then navigate
                        val intent = Intent(this@LoginActivity, MainActivity::class.java)
                        startActivity(intent)
                        finish()
                    } else {
                        // handle login error
                    }

                    if (loginResponse != null && user != null && !user._id.isNullOrEmpty()) {
                        // ✅ Save session
                        SharedPrefs.saveToken(this@LoginActivity, loginResponse.token)
                        SharedPrefs.saveUserId(this@LoginActivity, user._id)

                        Log.i("LoginActivity", "✅ Login successful for: ${user.username}")
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()

                        // ✅ Update Player ID
                        OneSignalHelper.getPlayerIdAndUpdateToBackend(this@LoginActivity)

                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        Log.w("LoginActivity", "⚠️ Login response missing user data")
                        Toast.makeText(this@LoginActivity, "Login failed: Incomplete user info", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Log.e("LoginActivity", "❌ Invalid credentials. Code: ${response.code()}")
                    Toast.makeText(this@LoginActivity, "Invalid credentials", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                Log.e("LoginActivity", "❌ Network error: ${t.message}", t)
                Toast.makeText(this@LoginActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }
}
