package com.example.yenkasachat.ui


import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var editEmail: EditText
    private lateinit var btnResetPassword: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_forgot_password)

        editEmail = findViewById(R.id.editResetEmail)
        btnResetPassword = findViewById(R.id.btnResetPassword)

        btnResetPassword.setOnClickListener {
            val email = editEmail.text.toString().trim()

            if (email.isEmpty()) {
                editEmail.error = "Email is required"
                return@setOnClickListener
            }

            // TODO: Integrate actual API call if backend supports it
            Toast.makeText(this, "Reset link sent to $email", Toast.LENGTH_LONG).show()
        }
    }
}
