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

        // 📧 EMAIL VERIFICATION (BACKEND)
        btnEmailCode.setOnClickListener {
            val email = emailInput.text.toString().trim()
            if (email.isNotEmpty()) {
                sendEmailCode(email)
            } else {
                toast("Enter email")
            }
        }

        // 📱 PHONE VERIFICATION (FIREBASE)
        btnPhoneCode.setOnClickListener {
            val phone = phoneInput.text.toString().trim()
            if (phone.isNotEmpty()) {
                sendOtp(phone)
            } else {
                toast("Enter phone number")
            }
        }

        // ✅ CONFIRM OTP
        btnConfirmCode.setOnClickListener {
            val code = codeInput.text.toString().trim()
            if (code.isNotEmpty()) {
                verifyCode(code)
            } else {
                toast("Enter verification code")
            }
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
                            "Verification code sent to your email."
                        else
                            "Failed to send email"
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    statusText.text = "Error: ${t.message}"
                }
            })
    }

    // ================= FIREBASE PHONE =================

    private fun sendOtp(phone: String) {
        val options = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(phone)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(this)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {

                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    signInWithCredential(credential)
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    statusText.text =
                        "SMS failed. Please verify via email."
                }

                override fun onCodeSent(
                    id: String,
                    token: PhoneAuthProvider.ForceResendingToken
                ) {
                    verificationId = id
                    statusText.text = "SMS code sent"
                }
            })
            .build()

        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    private fun verifyCode(code: String) {
        val id = verificationId
        if (id == null) {
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

                    statusText.text = "✅ Phone verified successfully"

                } else {
                    toast("Invalid verification code")
                }
            }
    }

    // ================= UTILS =================

    private fun toast(msg: String) {
        Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()
    }
}
