package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.text.method.LinkMovementMethod
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.model.RegisterRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.network.ApiClient
import com.google.android.material.textfield.TextInputEditText
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class RegisterActivity : AppCompatActivity() {

    private lateinit var radioEmail: RadioButton
    private lateinit var radioPhone: RadioButton
    private lateinit var editEmail: EditText
    private lateinit var editPhone: EditText
    private lateinit var editUsername: EditText
    private lateinit var editLocation: EditText
    private lateinit var editPassword: TextInputEditText
    private lateinit var editConfirmPassword: TextInputEditText
    private lateinit var btnRegister: Button
    private lateinit var textLoginLink: TextView
    private lateinit var checkTerms: CheckBox
    private lateinit var textTermsLink: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        radioEmail = findViewById(R.id.radioEmail)
        radioPhone = findViewById(R.id.radioPhone)
        editEmail = findViewById(R.id.editEmail)
        editPhone = findViewById(R.id.editPhone)
        editUsername = findViewById(R.id.editUsername)
        editLocation = findViewById(R.id.editLocation)
        editPassword = findViewById(R.id.editPassword)
        editConfirmPassword = findViewById(R.id.editConfirmPassword)
        btnRegister = findViewById(R.id.btnRegister)
        textLoginLink = findViewById(R.id.textLoginLink)
        checkTerms = findViewById(R.id.checkTerms)
        textTermsLink = findViewById(R.id.textTermsLink)

        // Handle email/phone visibility
        radioEmail.setOnCheckedChangeListener { _, isChecked ->
            editEmail.visibility = if (isChecked) View.VISIBLE else View.GONE
            editPhone.visibility = if (!isChecked) View.VISIBLE else View.GONE
        }

        // Open User Agreement Activity when link is tapped
        textTermsLink.setOnClickListener {
            val intent = Intent(this, UserAgreementActivity::class.java)
            startActivity(intent)
        }

        btnRegister.setOnClickListener {
            handleRegister()
        }

        textLoginLink.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun handleRegister() {
        val email = editEmail.text.toString().trim()
        val phone = editPhone.text.toString().trim()
        val username = editUsername.text.toString().trim()
        val location = editLocation.text.toString().trim()
        val password = editPassword.text.toString()
        val confirmPassword = editConfirmPassword.text.toString()

        if (radioEmail.isChecked && email.isEmpty()) {
            editEmail.error = "Email is required"
            return
        }

        if (radioPhone.isChecked && phone.isEmpty()) {
            editPhone.error = "Phone is required"
            return
        }

        if (username.isEmpty()) {
            editUsername.error = "Username is required"
            return
        }

        if (location.isEmpty()) {
            editLocation.error = "Location is required"
            return
        }

        if (password.length < 6) {
            editPassword.error = "Password must be at least 6 characters"
            return
        }

        if (password != confirmPassword) {
            editConfirmPassword.error = "Passwords do not match"
            return
        }

        if (!checkTerms.isChecked) {
            Toast.makeText(this, "You must agree to the User Agreement before continuing.", Toast.LENGTH_LONG).show()
            return
        }

        val request = RegisterRequest(
            email = if (radioEmail.isChecked) email else null,
            phone = if (radioPhone.isChecked) phone else null,
            username = username,
            location = location,
            password = password
        )

        ApiClient.authService.registerUser(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    Toast.makeText(this@RegisterActivity, "Registered successfully", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this@RegisterActivity, LoginActivity::class.java))
                    finish()
                } else {
                    Toast.makeText(this@RegisterActivity, "Registration failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                Toast.makeText(this@RegisterActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }
}
