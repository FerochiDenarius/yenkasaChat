package com.example.yenkasachat.ui

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.model.UpdateProfileRequest
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.launch

class EditProfileActivity : AppCompatActivity() {

    private lateinit var usernameView: TextInputEditText
    private lateinit var emailView: TextInputEditText
    private lateinit var phoneView: TextInputEditText
    private lateinit var locationView: TextInputEditText
    private lateinit var btnSave: Button
    private val TAG = "EditProfileActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_edit_profile)

        // Bind Views
        usernameView = findViewById(R.id.editUsername)
        emailView = findViewById(R.id.editEmail)
        phoneView = findViewById(R.id.editPhone)
        locationView = findViewById(R.id.editLocation)
        btnSave = findViewById(R.id.btnSave)

        // Load current user data into fields
        loadCurrentData()

        // Set listener
        btnSave.setOnClickListener { saveUserProfile() }
    }

    private fun loadCurrentData() {
        usernameView.setText(TokenManager.getUsername(this))
        emailView.setText(TokenManager.getEmail(this))
        phoneView.setText(TokenManager.getPhone(this))
        locationView.setText(TokenManager.getLocation(this))
    }

    private fun saveUserProfile() {
        lifecycleScope.launch {
            try {
                val request = UpdateProfileRequest(
                    username = usernameView.text.toString().trim(),
                    email = emailView.text.toString().trim(),
                    phone = phoneView.text.toString().trim(),
                    location = locationView.text.toString().trim()
                )
                // Network call to update profile
                val response = ApiClient.apiService.updateProfile(request)
                if (response.isSuccessful) {
                    Toast.makeText(this@EditProfileActivity, "Profile saved successfully!", Toast.LENGTH_SHORT).show()

                    // Update local storage
                    TokenManager.savePartialUserDetails(
                        this@EditProfileActivity,
                        request.username,
                        request.email,
                        request.phone,
                        request.location
                    )

                    setResult(Activity.RESULT_OK) // Notify parent activity to refresh
                    finish()
                } else {
                    Toast.makeText(this@EditProfileActivity, "Save failed. Please try again.", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@EditProfileActivity, "Network error: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
