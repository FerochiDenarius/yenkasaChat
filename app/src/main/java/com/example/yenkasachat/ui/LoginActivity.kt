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
            // Token exists, skip login
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish()
            return
        }

        // No token, show login screen
        setContentView(R.layout.activity_login)
        // ... your existing login logic ...
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
                        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("userId", loginResponse.user._id) // ✅ FIXED: use _id
                            .putString("token", loginResponse.token)
                            .putString("username", loginResponse.user.username)
                            .putString("email", loginResponse.user.email ?: "")
                            .putString("phone", loginResponse.user.phone ?: "")
                            .putString("location", loginResponse.user.location)
                            .putBoolean("verified", loginResponse.user.verified)
                            .apply() // ✅ Better than commit() for async save

                        // Debug logs
                        Log.d("LoginSuccess", "Saved userId: ${loginResponse.user._id}")
                        Log.d("LoginSuccess", "Saved token: ${loginResponse.token}")
                        Log.d("LoginSuccess", "Saved username: ${loginResponse.user.username}")

                        Toast.makeText(
                            this@LoginActivity,
                            "Login successful",
                            Toast.LENGTH_SHORT
                        ).show()

                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        Toast.makeText(
                            this@LoginActivity,
                            "Unexpected response from server",
                            Toast.LENGTH_SHORT
                        ).show()
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
                Toast.makeText(
                    this@LoginActivity,
                    "Network error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }
}
