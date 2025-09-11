package com.example.yenkasachat.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.network.ApiClient // Assuming this is your Retrofit client
import kotlinx.coroutines.launch
import com.example.yenkasachat.model.ResetPasswordRequest
import okhttp3.ResponseBody
import retrofit2.Response

class ResetPasswordActivity : AppCompatActivity() {
    private lateinit var newPasswordField: EditText
    private lateinit var confirmPasswordField: EditText // Added for password confirmation
    private lateinit var resetButton: Button
    private lateinit var progressBar: ProgressBar // Added for visual feedback

    private var resetToken: String? = null
    private val TAG = "ResetPasswordActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reset_password) // Ensure this layout has all views

        Log.d(TAG, "onCreate called")

        newPasswordField = findViewById(R.id.newPassword) // Ensure ID matches your layout
        confirmPasswordField = findViewById(R.id.confirmNewPassword) // Add this EditText to your layout
        resetButton = findViewById(R.id.resetButton)     // Ensure ID matches your layout
        progressBar = findViewById(R.id.progressBarReset) // Add this ProgressBar to your layout

        handleIntent(intent)

        resetButton.setOnClickListener {
            val newPassword = newPasswordField.text.toString().trim()
            val confirmPassword = confirmPasswordField.text.toString().trim()

            if (validateInput(newPassword, confirmPassword)) {
                resetToken?.let { token ->
                    performApiPasswordReset(newPassword, token)
                } ?: Toast.makeText(this, "Reset token is missing. Please use the link from your email.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        Log.d(TAG, "onNewIntent called")
        // Handle new intent if activity is already running (e.g., due to launchMode="singleTask")
        // Make sure to update the activity's intent
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action: String? = intent?.action
        val data: Uri? = intent?.data

        Log.d(TAG, "Handling intent. Action: $action, Data: $data")

        if (Intent.ACTION_VIEW == action && data != null) {
            // Correctly get the token from query parameter
            resetToken = data.getQueryParameter("token")
            if (resetToken != null) {
                Log.i(TAG, "Reset token found: $resetToken")
                // Optionally, if you have a non-editable TextView to display the token or part of it:
                // val tokenDisplayTextView = findViewById<TextView>(R.id.tokenDisplay)
                // tokenDisplayTextView.text = "Token: $resetToken" // Or just log it
            } else {
                Log.e(TAG, "Reset token not found in URL query parameters.")
                Toast.makeText(this, "Invalid password reset link: Token missing.", Toast.LENGTH_LONG).show()
                finish() // Can't proceed without a token
            }
        } else {
            Log.w(TAG, "Intent action is not ACTION_VIEW or data is null. Activity might have been launched differently.")
            // If launched without a deep link, and no token was previously set (e.g. from savedInstanceState)
            if (resetToken == null) {
                Toast.makeText(this, "Invalid entry point for password reset.", Toast.LENGTH_LONG).show()
                // finish() // Decide if you want to close if not opened via app link
            }
        }
    }

    private fun validateInput(password: String, confirm: String): Boolean {
        if (password.isEmpty()) {
            newPasswordField.error = "Password cannot be empty."
            newPasswordField.requestFocus()
            return false
        }
        // Add more password strength rules if needed (e.g., length)
        if (password.length < 6) {
            newPasswordField.error = "Password must be at least 6 characters."
            newPasswordField.requestFocus()
            return false
        }
        if (confirm.isEmpty()) {
            confirmPasswordField.error = "Please confirm your password."
            confirmPasswordField.requestFocus()
            return false
        }
        if (password != confirm) {
            confirmPasswordField.error = "Passwords do not match."
            confirmPasswordField.requestFocus()
            return false
        }
        newPasswordField.error = null
        confirmPasswordField.error = null
        return true
    }



    private fun performApiPasswordReset(password: String, token: String) {
        Log.d(TAG, "Attempting to reset password with token: $token")

        val finalUrl = ApiClient.BASE_URL + "reset-password/confirm/$token"
        Log.d(TAG, "Final API URL being called: $finalUrl")
        Log.d(TAG, "Request body being sent: {\"newPassword\":\"$password\"}")

        progressBar.visibility = View.VISIBLE
        resetButton.isEnabled = false

        lifecycleScope.launch {
            try {
                // ✅ Use data class instead of map
                val request = ResetPasswordRequest(newPassword = password)

                val response: Response<ResponseBody> = ApiClient.apiService.resetPassword(token, request)

                if (response.isSuccessful) {
                    Log.i(TAG, "Password reset API call successful.")
                    Toast.makeText(
                        this@ResetPasswordActivity,
                        "Password updated successfully!",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    Log.e(TAG, "Password reset API call failed. Code: ${response.code()}, Error: $errorBody")
                    Toast.makeText(
                        this@ResetPasswordActivity,
                        "Failed to reset password: $errorBody",
                        Toast.LENGTH_LONG
                    ).show()
                }
            } catch (e: Exception) {
                Log.e(TAG, "Exception during password reset API call", e)
                Toast.makeText(
                    this@ResetPasswordActivity,
                    "An error occurred: ${e.message}",
                    Toast.LENGTH_LONG
                ).show()
            } finally {
                progressBar.visibility = View.GONE
                resetButton.isEnabled = true
            }
        }
    }
    // Optional: Save and restore token on configuration changes if needed, though App Links
    // usually re-deliver the intent.
    // override fun onSaveInstanceState(outState: Bundle) {
    //     super.onSaveInstanceState(outState)
    //     outState.putString("resetToken", resetToken)
    // }

    // override fun onRestoreInstanceState(savedInstanceState: Bundle) {
    //     super.onRestoreInstanceState(savedInstanceState)
    //     if (resetToken == null) { // Only restore if not already set by an intent
    //        resetToken = savedInstanceState.getString("resetToken")
    //        // If restoring and token exists, you might want to update UI or re-validate
    //        Log.d(TAG, "Restored token from savedInstanceState: $resetToken")
    //     }
    // }
}

