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
import xyz.yenkasa.app.model.PhoneRequest
import xyz.yenkasa.app.model.ConfirmPhoneRequest
import xyz.yenkasa.app.network.ApiClient
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Response

class PhoneVerificationActivity : AppCompatActivity() {

    private lateinit var phoneInputEditText: EditText
    private lateinit var requestPhoneCodeButton: Button
    private lateinit var codeInputEditText: EditText
    private lateinit var confirmCodeButton: Button
    private lateinit var statusResultTextView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verification)

        phoneInputEditText = findViewById(R.id.editPhone)
        requestPhoneCodeButton = findViewById(R.id.btnRequestPhoneCode)
        codeInputEditText = findViewById(R.id.editCode)
        confirmCodeButton = findViewById(R.id.btnConfirmCode)
        statusResultTextView = findViewById(R.id.textStatus)

        // Request phone verification code
        requestPhoneCodeButton.setOnClickListener {
            val phone = phoneInputEditText.text.toString().trim()
            if (phone.isNotBlank() && phone.startsWith("+")) {
                requestUserPhoneVerification(phone)
            } else {
                phoneInputEditText.error = getString(R.string.error_valid_phone_e164)
                Toast.makeText(this, getString(R.string.enter_phone_e164), Toast.LENGTH_SHORT).show()
            }
        }

        // Confirm phone verification code
        confirmCodeButton.setOnClickListener {
            val phone = phoneInputEditText.text.toString().trim()
            val code = codeInputEditText.text.toString().trim()

            if (phone.isEmpty() || code.isEmpty()) {
                Toast.makeText(this, getString(R.string.enter_phone_and_code), Toast.LENGTH_SHORT).show()
            } else {
                confirmPhoneVerification(phone, code)
            }
        }
    }

    private fun requestUserPhoneVerification(phone: String) {
        requestPhoneCodeButton.isEnabled = false
        statusResultTextView.text = getString(R.string.requesting_sms_code)

        val phonePayload = PhoneRequest(phone = phone)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.requestPhoneVerification(phonePayload)

                if (response.isSuccessful) {
                    val body = response.body()
                    val message = body?.message ?: getString(R.string.verification_code_sent)
                    statusResultTextView.text = getString(R.string.status_success, message)
                    Toast.makeText(this@PhoneVerificationActivity, message, Toast.LENGTH_LONG).show()
                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                val message = getString(R.string.network_error_with_message, e.message ?: "")
                statusResultTextView.text = getString(R.string.status_error, message)
                Toast.makeText(this@PhoneVerificationActivity, message, Toast.LENGTH_LONG).show()
                Log.e("PhoneVerification", "Exception in requestUserPhoneVerification: ", e)
            } finally {
                requestPhoneCodeButton.isEnabled = true
            }
        }
    }

    private fun confirmPhoneVerification(phone: String, code: String) {
        confirmCodeButton.isEnabled = false
        statusResultTextView.text = getString(R.string.confirming_sms_code)

        val payload = ConfirmPhoneRequest(phone = phone, code = code)

        lifecycleScope.launch {
            try {
                val response = ApiClient.apiService.confirmPhoneVerification(payload)
                if (response.isSuccessful) {
                    val body = response.body()
                    val message = body?.message ?: getString(R.string.phone_verified)
                    statusResultTextView.text = getString(R.string.status_success, message)
                    Toast.makeText(this@PhoneVerificationActivity, message, Toast.LENGTH_LONG).show()
                } else {
                    handleErrorResponse(response)
                }
            } catch (e: Exception) {
                statusResultTextView.text = getString(
                    R.string.status_error,
                    getString(R.string.network_error_with_message, e.message ?: "")
                )
                Log.e("PhoneVerification", "Exception in confirmPhoneVerification: ", e)
            } finally {
                confirmCodeButton.isEnabled = true
            }
        }
    }

    private fun handleErrorResponse(response: Response<*>) {
        val code = response.code()
        val raw = try {
            response.errorBody()?.string()
        } catch (e: Exception) {
            null
        }

        var errorMessage = getString(R.string.server_error_code, code)
        if (!raw.isNullOrBlank()) {
            try {
                if (raw.trim().startsWith("{")) {
                    val json = JSONObject(raw)
                    errorMessage = json.optString("message", errorMessage)
                } else {
                    errorMessage = raw.take(200)
                }
            } catch (e: Exception) {
                Log.e("PhoneVerification", "Error parsing errorBody: ${e.message}")
            }
        }

        statusResultTextView.text = getString(R.string.status_error, errorMessage)
        Toast.makeText(this, errorMessage, Toast.LENGTH_LONG).show()
    }
}
