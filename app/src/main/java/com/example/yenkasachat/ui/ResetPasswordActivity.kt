package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.network.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.example.yenkasachat.R
class ResetPasswordActivity : AppCompatActivity() {
    private lateinit var newPasswordField: EditText
    private lateinit var resetButton: Button
    private var resetToken: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_reset_password)

        newPasswordField = findViewById(R.id.newPassword)
        resetButton = findViewById(R.id.resetButton)

        // Get the token from the deep link
        val data = intent?.data
        resetToken = data?.pathSegments?.lastOrNull()

        resetButton.setOnClickListener {
            val newPassword = newPasswordField.text.toString()
            if (newPassword.isNotEmpty() && resetToken != null) {
                resetPassword(newPassword, resetToken!!)
            } else {
                Toast.makeText(this, "Please enter a password.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun resetPassword(password: String, token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val body = mapOf("password" to password)
                val response = ApiClient.apiService.resetPassword(token, body)
                runOnUiThread {
                    if (response.isSuccessful) {
                        Toast.makeText(this@ResetPasswordActivity, "Password updated!", Toast.LENGTH_LONG).show()
                        finish()
                    } else {
                        Toast.makeText(this@ResetPasswordActivity, "Failed to reset password.", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@ResetPasswordActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
