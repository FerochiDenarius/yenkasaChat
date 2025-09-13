package com.example.yenkasachat.ui

import android.app.Activity // Import Activity for setResult
import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager // Import TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class VerificationActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var codeInput: EditText
    private lateinit var btnEmailCode: Button
    private lateinit var btnPhoneCode: Button
    private lateinit var btnConfirmCode: Button
    private lateinit var statusText: TextView

    // --- NEW ---
    private var currentVerificationType: String? = null // "email" or "phone"
    private var identifierForVerification: String? = null // Stores the email or phone being verified
    private companion object {
        const val TYPE_EMAIL = "email"
        const val TYPE_PHONE = "phone"
        private const val TAG = "VerificationActivity"
    }
    // --- END NEW ---

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        emailInput = findViewById(R.id.editEmail)
        phoneInput = findViewById(R.id.editPhone)
        codeInput = findViewById(R.id.editCode)
        btnEmailCode = findViewById(R.id.btnRequestEmailCode)
        btnPhoneCode = findViewById(R.id.btnRequestPhoneCode)
        btnConfirmCode = findViewById(R.id.btnConfirmCode)
        statusText = findViewById(R.id.textStatus)

        // Get identifier from Intent if AccountInfoActivity passes it (recommended)
        // This makes it less reliant on user input if they navigate away and back.
        val initialEmail = intent.getStringExtra("USER_EMAIL")
        val initialPhone = intent.getStringExtra("USER_PHONE")

        if (!initialEmail.isNullOrEmpty()) {
            emailInput.setText(initialEmail)
            // If email is passed, assume email verification is the primary goal initially
            // currentVerificationType = TYPE_EMAIL // Or set based on which button is more prominent
            // identifierForVerification = initialEmail
        }
        if (!initialPhone.isNullOrEmpty()) {
            phoneInput.setText(initialPhone)
            // If phone is passed, and email isn't, maybe default to phone
            // if (initialEmail.isNullOrEmpty()) currentVerificationType = TYPE_PHONE
            // identifierForVerification = initialPhone
        }


        btnEmailCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isNotBlank() && android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                // --- NEW ---
                currentVerificationType = TYPE_EMAIL
                identifierForVerification = email
                // --- END NEW ---
                sendEmailCode(email)
            } else {
                emailInput.error = "Enter a valid email"
                Toast.makeText(this, "Enter a valid email", Toast.LENGTH_SHORT).show()
            }
        }

        btnPhoneCode.setOnClickListener {
            val phone = phoneInput.text.toString().trim()
            // Add your phone number validation logic here if needed
            if (phone.isNotBlank() && phone.length > 5) { // Basic check
                // --- NEW ---
                currentVerificationType = TYPE_PHONE
                identifierForVerification = phone
                // --- END NEW ---
                sendPhoneCode(phone)
            } else {
                phoneInput.error = "Enter a valid phone number"
                Toast.makeText(this, "Enter a valid phone number", Toast.LENGTH_SHORT).show()
            }
        }

        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()

            if (identifierForVerification.isNullOrEmpty() || currentVerificationType.isNullOrEmpty()) {
                Toast.makeText(this, "Please request a code first (for email or phone).", Toast.LENGTH_LONG).show()
                return@setOnClickListener
            }
            if (code.isEmpty()) {
                codeInput.error = "Enter verification code"
                Toast.makeText(this, "Enter verification code", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // --- Pass currentVerificationType and the correct identifier ---
            confirmVerification(identifierForVerification!!, code, currentVerificationType!!)
        }
    }

    private fun sendEmailCode(email: String) {
        statusText.text = "Sending email code..."
        btnEmailCode.isEnabled = false // Disable while sending
        val body = mapOf("email" to email)
        ApiClient.authService.requestEmailVerification(body)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    statusText.text = if (response.isSuccessful) {
                        Log.i(TAG, "Email verification code sent successfully to $email")
                        "Verification code sent to your email."
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "Failed to send email verification code to $email: ${response.code()} - $errorMsg")
                        "Failed to send email: ${response.code()}"
                    }
                    btnEmailCode.isEnabled = true
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e(TAG, "Network error sending email verification code to $email: ${t.message}", t)
                    statusText.text = "Error sending code: ${t.message}"
                    btnEmailCode.isEnabled = true
                }
            })
    }

    private fun sendPhoneCode(phone: String) {
        statusText.text = "Sending phone code..."
        btnPhoneCode.isEnabled = false // Disable while sending
        val body = mapOf("phone" to phone) // Backend needs to expect "phone" key
        ApiClient.authService.requestPhoneVerification(body) // Ensure this endpoint exists and works
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    statusText.text = if (response.isSuccessful) {
                        Log.i(TAG, "Phone verification code sent successfully to $phone")
                        "Verification code sent via SMS."
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "Failed to send phone verification code to $phone: ${response.code()} - $errorMsg")
                        "SMS send failed: ${response.code()}"
                    }
                    btnPhoneCode.isEnabled = true
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Log.e(TAG, "Network error sending phone verification code to $phone: ${t.message}", t)
                    statusText.text = "SMS error: ${t.message}"
                    btnPhoneCode.isEnabled = true
                }
            })
    }

    // --- MODIFIED confirmVerification signature ---
    private fun confirmVerification(identifier: String, code: String, type: String) {
        statusText.text = "Confirming code..."
        btnConfirmCode.isEnabled = false

        // Construct body based on type. Your backend for confirmVerification
        // needs to be flexible or you need separate endpoints.
        // Assuming your current confirmVerification on backend can take either "email" or "phone"
        // as the identifier field based on what you send.
        val body: Map<String, String> = when (type) {
            TYPE_EMAIL -> mapOf("email" to identifier, "code" to code)
            TYPE_PHONE -> mapOf("phone" to identifier, "code" to code) // Ensure backend handles "phone" key
            else -> {
                Log.e(TAG, "Unknown verification type for confirmation: $type")
                Toast.makeText(this, "Error: Unknown verification type.", Toast.LENGTH_LONG).show()
                btnConfirmCode.isEnabled = true
                return
            }
        }

        ApiClient.authService.confirmVerification(body) // This endpoint needs to handle 'email' or 'phone' in body
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(
                    call: Call<Map<String, Any>>,
                    response: Response<Map<String, Any>>
                ) {
                    btnConfirmCode.isEnabled = true
                    if (response.isSuccessful) {
                        Log.i(TAG, "$type verification successful for $identifier")
                        statusText.text = "✅ $type successfully verified!"
                        Toast.makeText(this@VerificationActivity, "$type successfully verified!", Toast.LENGTH_LONG).show()

                        // --- THIS IS THE CRITICAL UPDATE ---
                        // 1. Update TokenManager based on type
                        if (type == TYPE_EMAIL) {
                            TokenManager.setEmailVerifiedStatus(this@VerificationActivity, true)
                        } else if (type == TYPE_PHONE) {
                            TokenManager.setPhoneVerifiedStatus(this@VerificationActivity, true)
                        }

                        // 2. Set result for AccountInfoActivity
                        setResult(Activity.RESULT_OK)

                        // 3. Finish this activity
                        finish()
                        // --- END OF CRITICAL UPDATE ---

                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e(TAG, "$type verification failed for $identifier: ${response.code()} - $errorMsg")
                        statusText.text = "❌ Verification failed: ${response.code()}"
                        Toast.makeText(this@VerificationActivity, "Verification failed. Please try again.", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    btnConfirmCode.isEnabled = true
                    Log.e(TAG, "Network error during $type verification for $identifier: ${t.message}", t)
                    statusText.text = "❌ Error confirming code: ${t.message}"
                    Toast.makeText(this@VerificationActivity, "Network error. Please try again.", Toast.LENGTH_LONG).show()
                }
            })
    }
}
