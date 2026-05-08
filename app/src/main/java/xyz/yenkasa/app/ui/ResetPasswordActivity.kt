package xyz.yenkasa.app.ui

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
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.model.ResetPasswordRequest
import kotlinx.coroutines.launch
import okhttp3.ResponseBody
import retrofit2.Response

class ResetPasswordActivity : AppCompatActivity() {

    private lateinit var newPasswordField: EditText
    private lateinit var confirmPasswordField: EditText
    private lateinit var resetButton: Button
    private lateinit var progressBar: ProgressBar

    private var resetToken: String? = null
    private val TAG = "ResetPasswordActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reset_password)

        newPasswordField = findViewById(R.id.newPassword)
        confirmPasswordField = findViewById(R.id.confirmNewPassword)
        resetButton = findViewById(R.id.resetButton)
        progressBar = findViewById(R.id.progressBarReset)

        handleIntent(intent)

        resetButton.setOnClickListener {
            val newPassword = newPasswordField.text.toString().trim()
            val confirmPassword = confirmPasswordField.text.toString().trim()

            if (validateInput(newPassword, confirmPassword)) {
                resetToken?.let { token ->
                    performApiPasswordReset(newPassword, token)
                } ?: Toast.makeText(
                    this,
                    "Reset token is missing. Please use the link from your email.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val action = intent?.action
        val data: Uri? = intent?.data

        if (Intent.ACTION_VIEW == action && data != null) {
            resetToken = data.getQueryParameter("token")
            if (resetToken != null) {
                Log.i(TAG, "Reset token found: $resetToken")
            } else {
                Toast.makeText(this, "Invalid password reset link: Token missing.", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }

    private fun validateInput(password: String, confirm: String): Boolean {
        if (password.isEmpty()) {
            newPasswordField.error = "Password cannot be empty."
            return false
        }
        if (password.length < 6) {
            newPasswordField.error = "Password must be at least 6 characters."
            return false
        }
        if (confirm.isEmpty()) {
            confirmPasswordField.error = "Please confirm your password."
            return false
        }
        if (password != confirm) {
            confirmPasswordField.error = "Passwords do not match."
            return false
        }
        return true
    }

    private fun performApiPasswordReset(password: String, token: String) {
        Log.d(TAG, "Attempting to reset password with token: $token")

        progressBar.visibility = View.VISIBLE
        resetButton.isEnabled = false

        lifecycleScope.launch {
            try {
                val request = ResetPasswordRequest(newPassword = password)
                val response: Response<ResponseBody> =
                    ApiClient.apiService.resetPassword(token, request)

                if (response.isSuccessful) {
                    Toast.makeText(
                        this@ResetPasswordActivity,
                        "Password updated successfully!",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    Log.e(TAG, "Password reset failed: $errorBody")
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
}
