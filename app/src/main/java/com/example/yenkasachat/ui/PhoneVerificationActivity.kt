package com.example.yenkasachat.ui

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.model.PhoneRequest
import com.example.yenkasachat.model.ConfirmPhoneRequest
import com.example.yenkasachat.model.VerificationResponse
import com.example.yenkasachat.network.ApiClient
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Response

class PhoneVerificationActivity : AppCompatActivity() {

    private lateinit var phoneInputEditText: EditText
    private lateinit var requestPhoneCodeButton: Button
    private lateinit var codeInputEditText: EditText
    private lateinit var confirmCodeButton: Button
    private lateinit var statusResultTextView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        phoneInputEditText = findViewById(R.id.editPhone)
        requestPhoneCodeButton = findViewById(R.id.btnRequestPhoneCode)
        codeInputEditText = findViewById(R.id.editCode)
        confirmCodeButton = findViewById(R.id.btnConfirmCode)
        statusResultTextView = findViewById(R.id.textStatus)

        // Request phone verification code
        requestPhoneCodeButton.setOnClickListener {
            val phone = phoneInputEditText.text.toString().trim()
            if (phone.isNotBlank() && phone.startsWith("+")) {
                requestUserPhoneVerification(phone)
            } else {
                phoneInputEditText.error = "Please enter a valid phone number (+233...)"
                Toast.makeText(this, "Enter phone number in E.164 format (+233...)", Toast.LENGTH_SHORT).show()
            }
        }

        // Confirm phone verification code
        confirmCodeButton.setOnClickListener {
            val phone = phoneInputEditText.text.toString().trim()
            val code = codeInputEditText.text.toString().trim()

            if (phone.isEmpty() || code.isEmpty()) {
                Toast.makeText(this, "Enter phone and verification code.", Toast.LENGTH_SHORT).show()
            } else {
                confirmPhoneVerification(phone, code)
            }
        }
    }

    private fun requestUserPhoneVerification(phone: String) {
        requestPhoneCodeButton.isEnabled = false
        statusResultTextView.text = "Requesting SMS code..."

        val phonePayload = PhoneRequest(phone = phone)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.requestPhoneVerification(phonePayload)

                if (response.isSuccessful) {
                    val body = response.body()
                    val message = body?.message ?: "Verification code sent. Check your phone."
                    statusResultTextView.text = "✅ $message"
                    Toast.makeText(this@PhoneVerificationActivity, message, Toast.LENGTH_LONG).show()
                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                statusResultTextView.text = "❌ Network error: ${e.message}"
                Toast.makeText(this@PhoneVerificationActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("PhoneVerification", "Exception in requestUserPhoneVerification: ", e)
            } finally {
                requestPhoneCodeButton.isEnabled = true
            }
        }
    }

    private fun confirmPhoneVerification(phone: String, code: String) {
        confirmCodeButton.isEnabled = false
        statusResultTextView.text = "Confirming SMS code..."

        val payload = ConfirmPhoneRequest(phone = phone, code = code)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.confirmPhoneVerification(payload)
                if (response.isSuccessful) {
                    val body = response.body()
                    val message = body?.message ?: "Phone verified."
                    statusResultTextView.text = "✅ $message"
                    Toast.makeText(this@PhoneVerificationActivity, message, Toast.LENGTH_LONG).show()
                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                statusResultTextView.text = "❌ Network error: ${e.message}"
                Log.e("PhoneVerification", "Exception in confirmPhoneVerification: ", e)
            } finally {
                confirmCodeButton.isEnabled = true
            }
        }
    }

    private fun handleErrorResponse(response: Response<*>) {
        val code = response.code()
        val raw = try {
            response.errorBody()?.string()
        } catch (e: Exception) {
            null
        }

        var errorMessage = "Server error (code $code)"
        if (!raw.isNullOrBlank()) {
            try {
                if (raw.trim().startsWith("{")) {
                    val json = JSONObject(raw)
                    errorMessage = json.optString("message", errorMessage)
                } else {
                    errorMessage = raw.take(200)
                }
            } catch (e: Exception) {
                Log.e("PhoneVerification", "Error parsing errorBody: ${e.message}")
            }
        }

        statusResultTextView.text = "❌ $errorMessage"
        Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
    }
}
