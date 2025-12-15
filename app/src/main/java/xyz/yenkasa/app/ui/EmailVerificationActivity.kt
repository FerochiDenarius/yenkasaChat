package xyz.yenkasa.app.ui

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.model.ConfirmRequest
import xyz.yenkasa.app.model.EmailRequest
import kotlinx.coroutines.launch
import androidx.core.content.ContextCompat
import org.json.JSONObject
import retrofit2.Response
import android.widget.LinearLayout



class EmailVerificationActivity : AppCompatActivity() {

    private lateinit var emailInputEditText: EditText
    private lateinit var requestEmailCodeButton: Button
    private lateinit var codeInputEditText: EditText
    private lateinit var confirmCodeButton: Button
    private lateinit var statusResultTextView: TextView
    private lateinit var verifiedLayout: LinearLayout
    private lateinit var emailStatus: TextView
    private lateinit var phoneStatus: TextView


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        emailInputEditText = findViewById(R.id.editEmail)
        requestEmailCodeButton = findViewById(R.id.btnRequestEmailCode)
        codeInputEditText = findViewById(R.id.editCode)
        confirmCodeButton = findViewById(R.id.btnConfirmCode)
        statusResultTextView = findViewById(R.id.textStatus)
        verifiedLayout = findViewById(R.id.layoutVerifiedStatus)
        emailStatus = findViewById(R.id.emailStatus)
        phoneStatus = findViewById(R.id.phoneStatus)


        // Request email verification code
        requestEmailCodeButton.setOnClickListener {
            val email = emailInputEditText.text.toString().trim()
            if (email.isNotBlank() && android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                requestUserEmailVerification(email)
            } else {
                emailInputEditText.error = "Please enter a valid email address."
                Toast.makeText(this, "Please enter a valid email address.", Toast.LENGTH_SHORT).show()
            }
        }

        // Confirm email verification code
        confirmCodeButton.setOnClickListener {
            val email = emailInputEditText.text.toString().trim()
            val code = codeInputEditText.text.toString().trim()

            if (email.isEmpty() || code.isEmpty()) {
                Toast.makeText(this, "Enter email and verification code.", Toast.LENGTH_SHORT).show()
            } else {
                confirmEmailVerification(email, code)
            }
        }
    }

    private fun requestUserEmailVerification(email: String) {
        requestEmailCodeButton.isEnabled = false
        statusResultTextView.text = "Requesting email code..."

        val emailPayload = EmailRequest(email = email)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.requestEmailVerification(emailPayload)


                if (response.isSuccessful) {
                    val body = response.body()
                    val message = body?.message ?: "Verification code sent. Check your email."
                    statusResultTextView.text = "✅ $message"
                    Toast.makeText(this@EmailVerificationActivity, message, Toast.LENGTH_LONG).show()
                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                statusResultTextView.text = "❌ Network error: ${e.message}"
                Toast.makeText(this@EmailVerificationActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                Log.e("EmailVerification", "Exception in requestUserEmailVerification: ", e)
            } finally {
                requestEmailCodeButton.isEnabled = true
            }
        }
    }

    private fun confirmEmailVerification(email: String, code: String) {
        confirmCodeButton.isEnabled = false
        statusResultTextView.text = "Confirming email code..."

        val payload = ConfirmRequest(email = email, code = code)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.confirmEmailVerification(payload)
                if (response.isSuccessful) {

                    val body = response.body()
                    val message = body?.message ?: "Email verified."

                    statusResultTextView.text = "✅ $message"
                    Toast.makeText(this@EmailVerificationActivity, message, Toast.LENGTH_LONG).show()

                    // 🔥 SHOW VERIFIED STATUS UI
                    // 🔥 SHOW VERIFIED STATUS UI
                    // 🔥 SHOW VERIFIED STATUS UI
                    verifiedLayout.visibility = LinearLayout.VISIBLE

                    emailStatus.text = "Verified"
                    emailStatus.setTextColor(
                        ContextCompat.getColor(
                            this@EmailVerificationActivity,
                            R.color.yenkasa_emerald
                        )
                    )

                    phoneStatus.text = "Not verified"
                    phoneStatus.setTextColor(
                        ContextCompat.getColor(
                            this@EmailVerificationActivity,
                            android.R.color.darker_gray
                        )
                    )



                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                statusResultTextView.text = "❌ Network error: ${e.message}"
                Log.e("EmailVerification", "Exception in confirmEmailVerification: ", e)
            } finally {
                confirmCodeButton.isEnabled = true
            }
        }
    }

    // Handle API error safely
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
                Log.e("EmailVerification", "Error parsing errorBody: ${e.message}")
            }
        }

        statusResultTextView.text = "❌ $errorMessage"
        Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
    }
}
