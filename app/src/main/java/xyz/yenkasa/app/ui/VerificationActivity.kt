package xyz.yenkasa.app.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
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
import android.os.CountDownTimer


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
    private lateinit var emailTimerLayout: LinearLayout
    private lateinit var emailTimerText: TextView
    private var emailCountDownTimer: CountDownTimer? = null

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
        emailTimerLayout = findViewById(R.id.layoutEmailTimer)
        emailTimerText = findViewById(R.id.textEmailTimer)
        emailTimerLayout.visibility = LinearLayout.GONE
        findViewById<ImageButton>(R.id.btnVerificationBack).setOnClickListener { finish() }


        setupFirebaseCallbacks()
        restoreVerificationState()




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
                toast(getString(R.string.enter_valid_email))
            }
        }

        // ================= PHONE =================
        btnPhoneCode.setOnClickListener {
            statusText.text = getString(R.string.sms_verification_coming_soon)
            toast(getString(R.string.sms_verification_not_ready))
        }

        // ================= CONFIRM =================
        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()

            if (code.isEmpty()) {
                toast(getString(R.string.enter_verification_code))
                return@setOnClickListener
            }

            when (currentMode) {
                VerificationMode.EMAIL -> {

                    if (!emailCodeRequested) {
                        toast(getString(R.string.request_verification_code_first))
                        return@setOnClickListener
                    }

                    confirmEmailVerification(code)
                }

                VerificationMode.PHONE -> {
                    verifyPhoneCode(code)
                }

                VerificationMode.NONE -> {
                    toast(getString(R.string.request_verification_code_first))
                }
            }
        }
    }

    // ================= EMAIL API =================

    private fun requestEmailVerification(email: String) {
        statusText.text = getString(R.string.requesting_email_code)
        btnEmailCode.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService
                    .requestEmailVerification(EmailRequest(email))

                Log.d("Verification", "📡 Email request response: ${response.code()}")

                if (response.isSuccessful) {
                    emailCodeRequested = true
                    statusText.text = getString(R.string.email_code_sent)
                    toast(getString(R.string.email_verification_code_sent))

                    val raw = response.body()?.let {
                        JSONObject(it.toString())
                    }

                    val seconds = raw?.optInt("expiresInSeconds", 180) ?: 180
                    startEmailCooldown(seconds)



                }

                else {
                    val raw = response.errorBody()?.string()
                    val json = JSONObject(raw ?: "")
                    val retry = json.optInt("retryAfterSeconds", -1)

                    if (retry > 0) {
                        startEmailCooldown(retry)
                    }

                    handleApiError(response)
                }


            } catch (e: Exception) {
                Log.e("Verification", "🔥 Email request error", e)
                toast(getString(R.string.network_error))
            }
        }
    }
    private fun startEmailCooldown(seconds: Int) {
        if (seconds <= 0) {
            btnEmailCode.isEnabled = true
            emailTimerLayout.visibility = LinearLayout.GONE
            return
        }

        emailCountDownTimer?.cancel()

        btnEmailCode.isEnabled = false
        emailTimerLayout.visibility = LinearLayout.VISIBLE

        emailCountDownTimer = object : CountDownTimer(seconds * 1000L, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                val totalSeconds = millisUntilFinished / 1000
                val minutes = totalSeconds / 60
                val secs = totalSeconds % 60
                emailTimerText.text = String.format(
                    getString(R.string.resend_in_time),
                    minutes,
                    secs
                )
            }

            override fun onFinish() {
                emailTimerLayout.visibility = LinearLayout.GONE
                btnEmailCode.isEnabled = true
            }
        }.start()
    }

    private fun confirmEmailVerification(code: String) {
        statusText.text = getString(R.string.confirming_email_code)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService
                    .confirmEmailVerification(code.trim())

                if (response.isSuccessful) {

                    // 1️⃣ Persist email verification
                    TokenManager.setEmailVerified(this@VerificationActivity, true)

                    statusText.text = getString(R.string.email_verified_status)

                    // 2️⃣ Update UI using stored truth
                    showVerifiedStatus(
                        emailVerified = true,
                        phoneVerified = TokenManager.isPhoneVerified(this@VerificationActivity)
                    )
                    startActivity(Intent(this@VerificationActivity, VerificationSuccessActivity::class.java))
                    finish()

                } else {
                    statusText.text = getString(R.string.invalid_or_expired_code)
                }

            } catch (e: Exception) {
                statusText.text = getString(R.string.verification_failed_try_again)
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
                statusText.text = getString(R.string.sms_verification_failed)
            }

            override fun onCodeSent(
                id: String,
                token: PhoneAuthProvider.ForceResendingToken
            ) {
                verificationId = id
                statusText.text = getString(R.string.sms_code_sent)
            }
        }
    }

    private fun sendOtp(phone: String) {
        statusText.text = getString(R.string.sending_sms)

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
            toast(getString(R.string.request_sms_code_first))
            return
        }

        val credential = PhoneAuthProvider.getCredential(id, code)
        signInWithCredential(credential)
    }

    private fun signInWithCredential(credential: PhoneAuthCredential) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {

                    TokenManager.setPhoneVerified(this, true)

                    statusText.text = getString(R.string.phone_verified_status)

                    showVerifiedStatus(
                        emailVerified = TokenManager.isEmailVerified(this),
                        phoneVerified = true
                    )

                } else {
                    toast(getString(R.string.invalid_verification_code))
                }
            }
    }

    // ================= UI HELPERS =================

    private fun showVerifiedStatus(emailVerified: Boolean, phoneVerified: Boolean) {
        verifiedLayout.visibility = LinearLayout.VISIBLE

        emailStatus.text = if (emailVerified) getString(R.string.verified) else getString(R.string.not_verified)
        emailStatus.setTextColor(
            ContextCompat.getColor(
                this,
                if (emailVerified) R.color.yenkasa_emerald else android.R.color.darker_gray
            )
        )

        phoneStatus.text = if (phoneVerified) getString(R.string.verified) else getString(R.string.not_verified)
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
            JSONObject(raw ?: "").optString("message", getString(R.string.server_error))
        } catch (e: Exception) {
            getString(R.string.server_error)
        }
        toast(msg)
    }
    private fun restoreVerificationState() {
        val emailVerified = TokenManager.isEmailVerified(this)
        val phoneVerified = TokenManager.isPhoneVerified(this)

        if (emailVerified || phoneVerified) {
            showVerifiedStatus(emailVerified, phoneVerified)
        } else {
            verifiedLayout.visibility = LinearLayout.GONE
        }
    }



    private fun formatPhone(input: String): String? {
        val trimmed = input.replace(" ", "")
        return if (trimmed.startsWith("+") && trimmed.length >= 10) trimmed else null
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}
