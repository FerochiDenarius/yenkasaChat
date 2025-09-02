package com.example.yenkasachat.ui

import android.content.Context
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.widget.EditText
import android.widget.Toast
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.model.UpdateProfileRequest

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ProfileEditor(private val context: Context) {

    private val TAG = "ProfileEditor" // Tag for easier filtering in Logcat

    fun attachAutoSave(editText: EditText, field: String) {
        Log.d(TAG, "Attaching auto-save to EditText for field: $field")
        editText.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val value = s?.toString()?.trim()
                Log.d(TAG, "afterTextChanged for field '$field': value = '$value'")
                if (!value.isNullOrEmpty()) {
                    saveToBackend(field, value)
                } else {
                    Log.d(TAG, "Value is null or empty for field '$field', not saving.")
                }
            }

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })
    }

    private fun saveToBackend(field: String, value: String) {
        Log.i(TAG, "saveToBackend called for field: '$field', value: '$value'") // Changed to Log.i for more visibility

        val requestBody = when (field.lowercase()) {
            "username" -> UpdateProfileRequest(username = value)
            "phone" -> UpdateProfileRequest(phone = value)
            "location" -> UpdateProfileRequest(location = value)
            else -> {
                Log.w(TAG, "Attempting to save unknown field: $field. Creating empty request.")
                UpdateProfileRequest()
            }
        }
        Log.d(TAG, "Constructed requestBody: $requestBody")


        if (requestBody.username == null && requestBody.phone == null && requestBody.location == null &&
            (field.lowercase() !in listOf("username", "phone", "location"))) {
            Log.w(TAG, "No specific field matched for update, NOT sending request for field: $field")
            return // IMPORTANT: If this condition is met, no request is sent.
        }

        Log.d(TAG, "Proceeding to launch network request for field: '$field'")

        CoroutineScope(Dispatchers.IO).launch {
            Log.d(TAG, "[IO Thread] Attempting API call for field: '$field'")
            try {
                val response = ApiClient.apiService.updateProfile(requestBody)
                Log.d(TAG, "[IO Thread] API call finished for field '$field'. Response code: ${response.code()}")

                launch(Dispatchers.Main) {
                    Log.d(TAG, "[Main Thread] Handling response for field '$field'")
                    if (response.isSuccessful) {
                        Log.i(TAG, "[Main Thread] Field '$field' updated successfully. Server Response: ${response.body()}")
                        val responseBodyContent = response.body()?.toString() ?: "No body" // Or parse specific fields from response
                        Log.d(TAG, "Response body content: $responseBodyContent")


                        when (field.lowercase()) {
                            "username" -> {
                                Log.d(TAG, "Saving username to TokenManager: $value")
                                TokenManager.saveUsername(context, value)
                            }
                            "phone" -> {
                                Log.d(TAG, "Saving phone to TokenManager: $value")
                                TokenManager.savePhone(context, value)
                            }
                            "location" -> {
                                Log.d(TAG, "Saving location to TokenManager: $value")
                                TokenManager.saveLocation(context, value)
                            }
                        }
                        Toast.makeText(context, "✅ $field updated ($value)", Toast.LENGTH_SHORT).show()
                    } else {
                        val errorBody = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "[Main Thread] Failed to update $field. Code: ${response.code()}, Error: $errorBody")
                        Toast.makeText(context, "❌ Failed to update $field: ${response.code()} $errorBody", Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "[IO Thread] Network error while updating $field: ${e.message}", e)
                launch(Dispatchers.Main) {
                    Toast.makeText(context, "❌ Network error for $field: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}
