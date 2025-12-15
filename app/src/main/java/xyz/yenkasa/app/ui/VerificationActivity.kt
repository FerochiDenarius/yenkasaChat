package xyz.yenkasa.app.ui

import android.content.Context
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.google.firebase.FirebaseException
import com.google.firebase.auth.*
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.util.concurrent.TimeUnit
import androidx.core.content.ContextCompat



class VerificationActivity : AppCompatActivity() {

    private lateinit var emailInput: EditText
    private lateinit var phoneInput: EditText
    private lateinit var codeInput: EditText
    private lateinit var btnEmailCode: Button
    private lateinit var btnPhoneCode: Button
    private lateinit var btnConfirmCode: Button
    private lateinit var statusText: TextView

    private lateinit var auth: FirebaseAuth
    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null

    // 🔥 Firebase callbacks must be a field
    private lateinit var callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks
    private lateinit var verifiedLayout: LinearLayout
    private lateinit var emailStatus: TextView
    private lateinit var phoneStatus: TextView


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        auth = FirebaseAuth.getInstance()

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

        // 📧 EMAIL (BACKEND)
        btnEmailCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isNotEmpty()) sendEmailCode(email)
            else toast("Enter email")
        }

        // 📱 PHONE (FIREBASE)
        btnPhoneCode.setOnClickListener {
            val phone = phoneInput.text.toString().trim()
            val formatted = formatPhone(phone)

            if (formatted == null) {
                toast("Use format +233XXXXXXXXX")
            } else {
                sendOtp(formatted)
            }
        }

        // ✅ CONFIRM SMS CODE
        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.isNotEmpty()) verifyCode(code)
            else toast("Enter verification code")
        }
    }

    // ================= EMAIL =================

    private fun sendEmailCode(email: String) {
        val body = mapOf("email" to email)

        ApiClient.authService.requestEmailVerification(body)
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(
                    call: Call<Map<String, Any>>,
                    response: Response<Map<String, Any>>
                ) {
                    statusText.text =
                        if (response.isSuccessful)
                            "📧 Email verification sent"
                        else
                            "❌ Email verification failed"
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    statusText.text = "❌ ${t.message}"
                }
            })
    }

    // ================= FIREBASE =================

    private fun setupFirebaseCallbacks() {
        callbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

            override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                // 🔥 Auto-verification (instant or SMS auto-read)
                signInWithCredential(credential)
            }

            override fun onVerificationFailed(e: FirebaseException) {
                statusText.text = "❌ SMS failed. Try email instead."
            }

            override fun onCodeSent(
                id: String,
                token: PhoneAuthProvider.ForceResendingToken
            ) {
                verificationId = id
                resendToken = token
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

    private fun verifyCode(code: String) {
        val id = verificationId ?: run {
            toast("Request SMS code first")
            return
        }

        val credential = PhoneAuthProvider.getCredential(id, code)
        signInWithCredential(credential)
    }

    // ================= HELPERS =================

    private fun formatPhone(input: String): String? {
        val trimmed = input.replace(" ", "")
        return if (trimmed.startsWith("+") && trimmed.length >= 10) trimmed else null
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }


        private fun showVerifiedStatus(
    emailVerified: Boolean,
    phoneVerified: Boolean
    ) {
        verifiedLayout.visibility = LinearLayout.VISIBLE

        if (emailVerified) {
            emailStatus.text = "Verified"
            emailStatus.setTextColor(
                ContextCompat.getColor(this, R.color.yenkasa_emerald)
            )
        } else {
            emailStatus.text = "Not verified"
            emailStatus.setTextColor(
                ContextCompat.getColor(this, android.R.color.darker_gray)
            )
        }

        if (phoneVerified) {
            phoneStatus.text = "Verified"
            phoneStatus.setTextColor(
                ContextCompat.getColor(this, R.color.yenkasa_emerald)
            )
        } else {
            phoneStatus.text = "Not verified"
            phoneStatus.setTextColor(
                ContextCompat.getColor(this, android.R.color.darker_gray)
            )
        }
    }

    private fun signInWithCredential(credential: PhoneAuthCredential) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener { task ->
                if (task.isSuccessful) {

                    getSharedPreferences("auth", Context.MODE_PRIVATE)
                        .edit()
                        .putBoolean("phone_verified", true)
                        .apply()

                    statusText.text = "✅ Phone verified successfully"

                    // 🔥 SHOW VERIFIED STATUS UI
                    showVerifiedStatus(
                        emailVerified = false,   // email may or may not be verified yet
                        phoneVerified = true
                    )

                } else {
                    toast("Invalid verification code")
                }
            }
    }

}
