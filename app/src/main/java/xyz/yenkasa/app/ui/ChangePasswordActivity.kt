package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.UpdatePasswordRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class ChangePasswordActivity : AppCompatActivity() {

    private lateinit var oldPass: TextInputEditText
    private lateinit var newPass: TextInputEditText
    private lateinit var confirmPass: TextInputEditText
    private lateinit var btnChange: Button

    private val token by lazy { TokenManager.getToken(this) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_change_password)

        bindViews()
        btnChange.setOnClickListener { changePassword() }
    }

    private fun bindViews() {
        oldPass = findViewById(R.id.oldPassword)
        newPass = findViewById(R.id.newPassword)
        confirmPass = findViewById(R.id.confirmPassword)
        btnChange = findViewById(R.id.btnChangePassword)
    }

    private fun changePassword() {
        val oldPassword = oldPass.text.toString().trim()
        val newPassword = newPass.text.toString().trim()
        val confirmPassword = confirmPass.text.toString().trim()

        if (oldPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty()) {
            Toast.makeText(this, "All fields are required", Toast.LENGTH_SHORT).show()
            return
        }

        if (newPassword != confirmPassword) {
            Toast.makeText(this, "New passwords do not match", Toast.LENGTH_SHORT).show()
            return
        }

        lifecycleScope.launch {
            try {
                val request = UpdatePasswordRequest(
                    oldPassword = oldPassword,
                    newPassword = newPassword
                )

                val response = ApiClient.apiService.updatePassword("Bearer $token", request)

                if (response.isSuccessful) {
                    Toast.makeText(
                        this@ChangePasswordActivity,
                        "Password changed successfully",
                        Toast.LENGTH_SHORT
                    ).show()
                    finish()
                } else {
                    Toast.makeText(
                        this@ChangePasswordActivity,
                        "Incorrect old password",
                        Toast.LENGTH_SHORT
                    ).show()
                }

            } catch (e: Exception) {
                Toast.makeText(
                    this@ChangePasswordActivity,
                    "Network error: ${e.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }
    }
}
