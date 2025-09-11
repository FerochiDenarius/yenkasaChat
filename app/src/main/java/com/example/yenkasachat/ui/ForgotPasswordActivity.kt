package com.example.yenkasachat.ui

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import com.example.yenkasachat.model.ForgotPasswordRequest
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope // Import for lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.ApiService
import kotlinx.coroutines.launch // Import for launch

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var editEmail: EditText
    private lateinit var btnResetPassword: Button
    private lateinit var progressBar: ProgressBar // Add a ProgressBar for feedback

    private val apiService: ApiService by lazy {
        ApiClient.apiService // Assuming ApiClient provides the instance
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_forgot_password)

        editEmail = findViewById(R.id.editResetEmail)
        btnResetPassword = findViewById(R.id.btnResetPassword)
        // Make sure you have a ProgressBar with this ID in your XML layout
        progressBar = findViewById(R.id.progressBarResetPassword)


        btnResetPassword.setOnClickListener {
            val email = editEmail.text.toString().trim()

            if (email.isEmpty()) {
                editEmail.error = "Email is required"
                editEmail.requestFocus()
                return@setOnClickListener
            }
            // Basic email validation (optional but recommended)
            if (!android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                editEmail.error = "Enter a valid email address"
                editEmail.requestFocus()
                return@setOnClickListener
            }

            // Call the function to handle password reset
            requestPasswordReset(email)
        }
    }

    private fun requestPasswordReset(email: String) {
        // Show progress bar and disable button
        progressBar.visibility = View.VISIBLE
        btnResetPassword.isEnabled = false
        editEmail.isEnabled = false

        // Use lifecycleScope to launch a coroutine
        lifecycleScope.launch {
            try {
                // Create the request body object
                val requestBody = ForgotPasswordRequest(email = email) // <-- CHANGE THIS
                // Call the API with the request body
                val response = apiService.requestPasswordReset(requestBody) // ✅ NEW

                if (response.isSuccessful) {
                    // Backend successfully processed the request (e.g., sent the email)
                    Toast.makeText(this@ForgotPasswordActivity, "If your email is registered, a password reset link has been sent.", Toast.LENGTH_LONG).show()
                    // Optionally, navigate back or to a confirmation screen
                    // finish()
                } else {
                    // Handle API errors (e.g., email not found, server error)
                    val errorBody = response.errorBody()?.string() ?: "Unknown error occurred"
                    Log.e("ForgotPassword", "API Error: ${response.code()} - $errorBody")
                    Toast.makeText(this@ForgotPasswordActivity, "Error: $errorBody", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                // Handle network errors or other exceptions
                Log.e("ForgotPassword", "Network/Exception: ${e.message}", e)
                Toast.makeText(this@ForgotPasswordActivity, "Failed to connect: ${e.message}", Toast.LENGTH_LONG).show()
            } finally {
                // Hide progress bar and re-enable button/input
                progressBar.visibility = View.GONE
                btnResetPassword.isEnabled = true
                editEmail.isEnabled = true
            }
        }
    }
}
