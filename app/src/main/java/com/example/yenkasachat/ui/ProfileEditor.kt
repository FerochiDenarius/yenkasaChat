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
import retrofit2.Response

class ProfileEditor(
    private val context: Context,
    private val lifecycleScope: LifecycleCoroutineScope
) {
    private val TAG = "ProfileEditor"
    private var saveJob: Job? = null

    fun attachAutoSave(editText: EditText, field: String) {

        editText.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val value = s?.toString()?.trim()

                saveJob?.cancel()
                saveJob = lifecycleScope.launch {
                    delay(600)

                    if (!value.isNullOrEmpty()) {
                        saveToBackend(field, value)
                    }
                }
            }

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })
    }

    private fun saveToBackend(field: String, value: String) {
        val token = TokenManager.getToken(context)
        if (token.isNullOrEmpty()) return

        val requestBody = when (field.lowercase()) {
            "username" -> UpdateProfileRequest(username = value)
            "email" -> UpdateProfileRequest(email = value)
            "phonenumber" -> UpdateProfileRequest(phoneNumber = value)
            "location" -> UpdateProfileRequest(location = value)
            else -> return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val response = ApiClient.apiService.updateProfile("Bearer $token", requestBody)
                withContext(Dispatchers.Main) {

                    if (response.isSuccessful && response.body() != null) {

                        updateTokenManager(field, value)

                        if (context is ProfileUpdateListener) {
                            context.onProfileUpdated(field, value)
                        }

                        Toast.makeText(context, "✔ $field updated", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(context, "❌ Update failed", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(context, "❌ Network error", Toast.LENGTH_SHORT).show()
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
    }

    interface ProfileUpdateListener {
        fun onProfileUpdated(field: String, value: String)
    }
}
