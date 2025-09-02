package com.example.yenkasachat.ui

import android.content.Context
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.widget.EditText
import android.widget.Toast
import androidx.lifecycle.LifecycleCoroutineScope
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.model.UpdateProfileRequest
import kotlinx.coroutines.*

class ProfileEditor(
    private val context: Context,
    private val lifecycleScope: LifecycleCoroutineScope
) {
    private val TAG = "ProfileEditor"
    private var saveJob: Job? = null

    fun attachAutoSave(editText: EditText, field: String) {
        Log.d(TAG, "Attaching auto-save to EditText for field: $field")

        editText.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val value = s?.toString()?.trim()
                Log.d(TAG, "afterTextChanged for field '$field': value = '$value'")

                saveJob?.cancel()
                saveJob = lifecycleScope.launch {
                    delay(600) // debounce to avoid spamming server
                    if (!value.isNullOrEmpty()) {
                        saveToBackend(field, value)
                    } else {
                        Log.d(TAG, "Value is null/empty for field '$field', not saving.")
                    }
                }
            }

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })
    }

    private fun saveToBackend(field: String, value: String) {
        Log.i(TAG, "saveToBackend called for field: '$field', value: '$value'")

        val requestBody = when (field.lowercase()) {
            "username" -> UpdateProfileRequest(username = value)
            "email" -> UpdateProfileRequest(email = value)
            "phone" -> UpdateProfileRequest(phone = value)
            "location" -> UpdateProfileRequest(location = value)
            else -> {
                Log.w(TAG, "Unknown field: $field. No request sent.")
                return
            }
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.apiService.updateProfile(requestBody)
                Log.d(TAG, "API response for '$field': code=${response.code()}")

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        Log.i(TAG, "Field '$field' updated successfully.")
                        updateTokenManager(field, value)

                        // Notify activity if it wants to react to updates
                        if (context is ProfileUpdateListener) {
                            context.onProfileUpdated(field, value)
                        }

                        Toast.makeText(
                            context,
                            "✅ $field updated ($value)",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        val errorBody = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "Failed to update $field. ${response.code()} - $errorBody")

                        val userMessage = when (response.code()) {
                            400 -> "Invalid data. Please check your input."
                            401 -> "Session expired. Please log in again."
                            500 -> "Server error. Try again later."
                            else -> "Unexpected error: ${response.code()}"
                        }
                        Toast.makeText(context, "❌ $userMessage", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Network error updating $field: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    Toast.makeText(
                        context,
                        "❌ Network error: ${e.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    private fun updateTokenManager(field: String, value: String) {
        when (field.lowercase()) {
            "username" -> TokenManager.saveUsername(context, value)
            "email" -> TokenManager.saveEmail(context, value)
            "phone" -> TokenManager.savePhone(context, value)
            "location" -> TokenManager.saveLocation(context, value)
        }
        Log.d(TAG, "TokenManager updated for $field: $value")
    }

    // Interface for activities/fragments to listen to updates
    interface ProfileUpdateListener {
        fun onProfileUpdated(field: String, value: String)
    }
}
