package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.content.Context

class VerificationActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var codeInput: EditText
    private lateinit var btnEmailCode: Button
    private lateinit var btnPhoneCode: Button
    private lateinit var btnConfirmCode: Button
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        // Bind UI components
        emailInput = findViewById(R.id.editEmail)
        phoneInput = findViewById(R.id.editPhone)
        codeInput = findViewById(R.id.editCode)
        btnEmailCode = findViewById(R.id.btnRequestEmailCode)
        btnPhoneCode = findViewById(R.id.btnRequestPhoneCode)
        btnConfirmCode = findViewById(R.id.btnConfirmCode)
        statusText = findViewById(R.id.textStatus)

        btnEmailCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isNotEmpty()) sendEmailCode(email)
            else Toast.makeText(this, "Enter email", Toast.LENGTH_SHORT).show()
        }

        btnPhoneCode.setOnClickListener {
            val phone = phoneInput.text.toString().trim()
            if (phone.isNotEmpty()) sendPhoneCode(phone)
            else Toast.makeText(this, "Enter phone number", Toast.LENGTH_SHORT).show()
        }

        btnConfirmCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            val code = codeInput.text.toString().trim()
            if (email.isEmpty() || code.isEmpty()) {
                Toast.makeText(this, "Fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            confirmVerification(email, code)
        }
    }

    private fun sendEmailCode(email: String) {
        val body = mapOf("email" to email)
        ApiClient.authService.requestEmailVerification(body)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    statusText.text = if (response.isSuccessful)
                        "Verification code sent to your email."
                    else
                        "Failed to send email: ${response.code()}"
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    statusText.text = "Error: ${t.message}"
                }
            })
    }

    private fun sendPhoneCode(phone: String) {
        val body = mapOf("phone" to phone)
        ApiClient.authService.requestPhoneVerification(body)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    statusText.text = if (response.isSuccessful)
                        "Verification code sent via SMS"
                    else
                        "SMS send failed: ${response.code()}"
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    statusText.text = "SMS error: ${t.message}"
                }
            })
    }

    private fun confirmVerification(email: String, code: String) {
        val body = mapOf("email" to email, "code" to code)

        ApiClient.authService.confirmVerification(body)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(
                    call: Call<Map<String, Any>>,
                    response: Response<Map<String, Any>>
                ) {
                    if (response.isSuccessful) {
                        // ✅ Save verified = true
                        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
                        prefs.edit().putBoolean("verified", true).apply()

                        statusText.text = "✅ Verification successful. Your account is now verified."
                    } else {
                        statusText.text = "❌ Verification failed: ${response.code()}"
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    statusText.text = "❌ Error: ${t.message}"
                }
            })
    }

}

