package xyz.yenkasa.app.ui

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.firebase.FirebaseException
import com.google.firebase.auth.*
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ConfirmRequest
import xyz.yenkasa.app.model.EmailRequest
import xyz.yenkasa.app.network.ApiClient
import java.util.concurrent.TimeUnit
import xyz.yenkasa.app.util.TokenManager

class VerificationActivity : AppCompatActivity() {

    // ================= MODE =================
    private enum class VerificationMode {
        NONE,
        EMAIL,
        PHONE
    }

    private var currentMode = VerificationMode.NONE

    // ================= EMAIL =================
    private lateinit var emailInput: EditText
    private lateinit var btnEmailCode: Button
    private var emailCodeRequested = false


    // ================= PHONE =================
    private lateinit var phoneInput: EditText
    private lateinit var codeInput: EditText
    private lateinit var btnPhoneCode: Button
    private lateinit var btnConfirmCode: Button

    // ================= UI =================
    private lateinit var statusText: TextView
    private lateinit var verifiedLayout: LinearLayout
    private lateinit var emailStatus: TextView
    private lateinit var phoneStatus: TextView

    // ================= FIREBASE =================
    private lateinit var auth: FirebaseAuth
    private var verificationId: String? = null
    private lateinit var callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        Log.e("Verification", "🔥 VerificationActivity CREATED")

        auth = FirebaseAuth.getInstance()

        // ===== BIND VIEWS =====
        emailInput = findViewById(R.id.editEmail)
        phoneInput = findViewById(R.id.editPhone)
        codeInput = findViewById(R.id.editCode)

        btnEmailCode = findViewById(R.id.btnRequestEmailCode)
        btnPhoneCode = findViewById(R.id.btnRequestPhoneCode)
        btnConfirmCode = findViewById(R.id.btnConfirmCode)

        statusText = findViewById(R.id.textStatus)
        verifiedLayout = findViewById(R.id.layoutVerifiedStatus)
        emailStatus = findViewById(R.id.emailStatus)
        phoneStatus = findViewById(R.id.phoneStatus)

        setupFirebaseCallbacks()

        // ================= EMAIL =================
        btnEmailCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            Log.d("Verification", "📧 Email code requested: $email")

            if (email.isNotBlank() &&
                android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()
            ) {
                currentMode = VerificationMode.EMAIL
                requestEmailVerification(email)
            } else {
                toast("Enter a valid email")
            }
        }

        // ================= PHONE =================
        btnPhoneCode.setOnClickListener {
            val phone = formatPhone(phoneInput.text.toString())
            if (phone == null) {
                toast("Use format +233XXXXXXXXX")
            } else {
                currentMode = VerificationMode.PHONE
                sendOtp(phone)
            }
        }

        // ================= CONFIRM =================
        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()

            if (code.isEmpty()) {
                toast("Enter verification code")
                return@setOnClickListener
            }

            when (currentMode) {
                VerificationMode.EMAIL -> {

                    if (!emailCodeRequested) {
                        toast("Request a verification code first")
                        return@setOnClickListener
                    }

                    confirmEmailVerification(code)
                }

                VerificationMode.PHONE -> {
                    verifyPhoneCode(code)
                }

                VerificationMode.NONE -> {
                    toast("Request a verification code first")
                }
            }
        }
    }

    // ================= EMAIL API =================

    private fun requestEmailVerification(email: String) {
        statusText.text = "Requesting email code..."
        btnEmailCode.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService
                    .requestEmailVerification(EmailRequest(email))

                Log.d("Verification", "📡 Email request response: ${response.code()}")

                if (response.isSuccessful) {
                    emailCodeRequested = true
                    statusText.text = "📧 Email code sent"
                    toast("Email verification code sent")
                } else {
                    handleApiError(response)
                }

            } catch (e: Exception) {
                Log.e("Verification", "🔥 Email request error", e)
                toast("Network error")
            } finally {
                btnEmailCode.isEnabled = true
            }
        }
    }

    private fun confirmEmailVerification(code: String) {
        statusText.text = "Confirming email code..."

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService
                    .confirmEmailVerification(code.trim())

                Log.d("Verification", "📡 Email confirm response: ${response.code()}")

                if (response.isSuccessful) {

                    // ✅ Mark EMAIL verified only
                    TokenManager.setEmailVerified(this@VerificationActivity, true)

                    statusText.text = "✅ Email verified"

                    showVerifiedStatus(
                        emailVerified = true,
                        phoneVerified = isPhoneVerified()
                    )

                } else {
                    statusText.text = "❌ Invalid or expired code"
                }

            } catch (e: Exception) {
                Log.e("Verification", "❌ Email verification failed", e)
                statusText.text = "⚠️ Verification failed. Try again."
            }
        }
    }




    // ================= FIREBASE PHONE =================

    private fun setupFirebaseCallbacks() {
        callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                signInWithCredential(credential)
            }

            override fun onVerificationFailed(e: FirebaseException) {
                statusText.text = "❌ SMS verification failed"
            }

            override fun onCodeSent(
                id: String,
                token: PhoneAuthProvider.ForceResendingToken
            ) {
                verificationId = id
                statusText.text = "📱 SMS code sent"
            }
        }
    }

    private fun sendOtp(phone: String) {
        statusText.text = "Sending SMS..."

        val options = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(phone)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(this)
            .setCallbacks(callbacks)
            .build()

        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    private fun verifyPhoneCode(code: String) {
        val id = verificationId ?: run {
            toast("Request SMS code first")
            return
        }

        val credential = PhoneAuthProvider.getCredential(id, code)
        signInWithCredential(credential)
    }

    private fun signInWithCredential(credential: PhoneAuthCredential) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {

                    TokenManager.setPhoneVerified(this@VerificationActivity, true)


                    statusText.text = "✅ Phone verified"

                    showVerifiedStatus(
                        emailVerified = false,
                        phoneVerified = true
                    )
                } else {
                    toast("Invalid verification code")
                }
            }
    }

    // ================= UI HELPERS =================

    private fun showVerifiedStatus(emailVerified: Boolean, phoneVerified: Boolean) {
        verifiedLayout.visibility = LinearLayout.VISIBLE

        emailStatus.text = if (emailVerified) "Verified" else "Not verified"
        emailStatus.setTextColor(
            ContextCompat.getColor(
                this,
                if (emailVerified) R.color.yenkasa_emerald else android.R.color.darker_gray
            )
        )

        phoneStatus.text = if (phoneVerified) "Verified" else "Not verified"
        phoneStatus.setTextColor(
            ContextCompat.getColor(
                this,
                if (phoneVerified) R.color.yenkasa_emerald else android.R.color.darker_gray
            )
        )
    }

    private fun isPhoneVerified(): Boolean {
        return TokenManager.isPhoneVerified(this)
    }


    private fun handleApiError(response: Response<*>) {
        val raw = response.errorBody()?.string()
        val msg = try {
            JSONObject(raw ?: "").optString("message", "Server error")
        } catch (e: Exception) {
            "Server error"
        }
        toast(msg)
    }

    private fun formatPhone(input: String): String? {
        val trimmed = input.replace(" ", "")
        return if (trimmed.startsWith("+") && trimmed.length >= 10) trimmed else null
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}
