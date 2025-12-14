package xyz.yenkasa.app.ui

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.UserPrivacyModel
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class PrivacySettingsActivity : AppCompatActivity() {

    private val api: ApiService by lazy { ApiClient.apiService }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_privacy_settings)

        val rbEveryone = findViewById<RadioButton>(R.id.rbEveryone)
        val rbApproval = findViewById<RadioButton>(R.id.rbApproval)
        val rbNobody = findViewById<RadioButton>(R.id.rbNobody)
        val btnSave = findViewById<Button>(R.id.btnSavePrivacy)

        // Load current privacy settings
        loadCurrentPrivacy(rbEveryone, rbApproval, rbNobody)

        // Save privacy option
        btnSave.setOnClickListener {
            val selectedLevel = when {
                rbEveryone.isChecked -> "everyone"
                rbApproval.isChecked -> "requires_approval"
                else -> "nobody"
            }

            savePrivacy(selectedLevel)
        }
    }

    private fun loadCurrentPrivacy(
        rbEveryone: RadioButton,
        rbApproval: RadioButton,
        rbNobody: RadioButton
    ) {
        api.getPrivacy().enqueue(object : Callback<UserPrivacyModel> {

            override fun onResponse(
                call: Call<UserPrivacyModel>,
                response: Response<UserPrivacyModel>
            ) {
                if (response.isSuccessful && response.body() != null) {
                    when (response.body()!!.privacyLevel) {
                        "everyone" -> rbEveryone.isChecked = true
                        "requires_approval" -> rbApproval.isChecked = true
                        "nobody" -> rbNobody.isChecked = true
                    }
                }
            }

            override fun onFailure(call: Call<UserPrivacyModel>, t: Throwable) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    "Failed to load settings",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun savePrivacy(level: String) {
        api.setPrivacy(level).enqueue(object : Callback<ApiResponse> {

            override fun onResponse(
                call: Call<ApiResponse>,
                response: Response<ApiResponse>
            ) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    response.body()?.message ?: "Saved!",
                    Toast.LENGTH_SHORT
                ).show()

                finish()
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(
                    this@PrivacySettingsActivity,
                    "Failed to save",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }
}
