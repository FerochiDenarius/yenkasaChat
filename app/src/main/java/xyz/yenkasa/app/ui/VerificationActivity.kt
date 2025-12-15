package xyz.yenkasa.app.ui

import android.content.Context
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseException
import com.google.firebase.auth.*
import xyz.yenkasa.app.R
import java.util.concurrent.TimeUnit

class VerificationActivity : AppCompatActivity() {

    private lateinit var phoneInput: EditText
    private lateinit var codeInput: EditText
    private lateinit var btnPhoneCode: Button
    private lateinit var btnConfirmCode: Button
    private lateinit var statusText: TextView

    private lateinit var verifiedLayout: LinearLayout
    private lateinit var emailStatus: TextView
    private lateinit var phoneStatus: TextView

    private lateinit var auth: FirebaseAuth
    private var verificationId: String? = null

    private lateinit var callbacks: PhoneAuthProvider.OnVerificationStateChangedCallbacks

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        auth = FirebaseAuth.getInstance()

        phoneInput = findViewById(R.id.editPhone)
        codeInput = findViewById(R.id.editCode)
        btnPhoneCode = findViewById(R.id.btnRequestPhoneCode)
        btnConfirmCode = findViewById(R.id.btnConfirmCode)
        statusText = findViewById(R.id.textStatus)

        verifiedLayout = findViewById(R.id.layoutVerifiedStatus)
        emailStatus = findViewById(R.id.emailStatus)
        phoneStatus = findViewById(R.id.phoneStatus)

        setupFirebaseCallbacks()

        btnPhoneCode.setOnClickListener {
            val phone = formatPhone(phoneInput.text.toString())
            if (phone == null) {
                toast("Use format +233XXXXXXXXX")
            } else {
                sendOtp(phone)
            }
        }

        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.isNotEmpty()) verifyCode(code)
            else toast("Enter verification code")
        }
    }

    // ================= FIREBASE =================

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

    private fun verifyCode(code: String) {
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

                    getSharedPreferences("auth", Context.MODE_PRIVATE)
                        .edit()
                        .putBoolean("phone_verified", true)
                        .apply()

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

    // ================= UI =================

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

    private fun formatPhone(input: String): String? {
        val trimmed = input.replace(" ", "")
        return if (trimmed.startsWith("+") && trimmed.length >= 10) trimmed else null
    }

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}
