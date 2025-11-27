package com.example.yenkasachat.ui

// Keep your existing imports
import android.content.Intent
import com.example.yenkasachat.network.SocketManager
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.activity.viewModels // Import for by viewModels()
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Observer // Import for LiveData Observer
import com.example.yenkasachat.R
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.google.android.material.textfield.TextInputEditText
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.Role
import com.example.yenkasachat.util.UserPermissions
// <--- Add this if not present
import com.example.yenkasachat.viewmodel.UserViewModel // Import UserViewModel
import com.onesignal.OneSignal
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import org.json.JSONObject // ✅ ADD THIS IMPORT for the new functionality

class LoginActivity : AppCompatActivity() {

    private lateinit var editIdentifier: EditText
    private lateinit var editPassword: TextInputEditText

    private lateinit var btnLogin: Button
    private lateinit var textRegisterLink: TextView
    // Instantiate UserViewModel using the 'by viewModels()' delegate
    private val userViewModel: UserViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Auto-login if BOTH token AND userId already exist
        val existingToken = TokenManager.getToken(this)
        val existingUserId = TokenManager.getUserId(this)

        Log.d(
            "LoginActivity",
            "🧾 Auto-Login Check - Token: $existingToken, UserID: $existingUserId"
        )

        if (!existingToken.isNullOrEmpty() && !existingUserId.isNullOrEmpty()) {
            Log.d("LoginActivity", "Token and UserID exist. Attempting auto-login to MainActivity.")
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish()
            return
        }

        Log.d("LoginActivity", "Token or UserID missing. Displaying login screen.")
        setContentView(R.layout.activity_login)

        // 🔹 Normal login setup
        editIdentifier = findViewById(R.id.editLoginIdentifier)
        editPassword = findViewById(R.id.editLoginPassword)
        btnLogin = findViewById(R.id.btnLogin)
        textRegisterLink = findViewById(R.id.textRegisterLink)
        val textForgotPassword: TextView = findViewById(R.id.textForgotPassword)

        btnLogin.setOnClickListener { handleLogin() }

        textRegisterLink.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
        }

        textForgotPassword.setOnClickListener {
            startActivity(Intent(this, ForgotPasswordActivity::class.java))
        }





        // 🔹 Player ID update observer
        userViewModel.playerIdUpdateResult.observe(this, Observer { success ->
            if (success) {
                Log.i("LoginActivity", "Player ID update successful (observed from ViewModel).")
            } else {
                Log.w("LoginActivity", "Player ID update failed (observed from ViewModel). Check UserViewModel logs.")
            }
        })
    }


    private fun handleLogin() {
        val identifier = editIdentifier.text.toString().trim()
        val password = editPassword.text.toString()

        if (identifier.isEmpty()) {
            editIdentifier.error = "Identifier cannot be empty"
            return
        }
        if (password.isEmpty()) {
            editPassword.error = "Password cannot be empty"
            return
        }
        if (identifier.contains("@") && !android.util.Patterns.EMAIL_ADDRESS.matcher(identifier).matches()) {
            editIdentifier.error = "Invalid email format"
            return
        }

        val request = LoginRequest(identifier, password)

        // ✅ REFACTORED BLOCK: The old enqueue block is replaced with the new, more detailed one.
        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful) {
                    val loginResponse = response.body()
                    val user = loginResponse?.user
                    val token = loginResponse?.token
                    val refreshToken = loginResponse?.refreshToken

                    // --- 🔥 Save primary community for duplicate-check protection ---
                    if (user?.community != null) {
                        try {
                            TokenManager.savePrimaryCommunityId(
                                this@LoginActivity,
                                user.community.id
                            )
                            Log.i("LoginActivity", "🏡 Primary community saved: ${user.community}")
                        } catch (e: Exception) {
                            Log.e("LoginActivity", "💥 Failed to save primary community: ${e.message}", e)
                        }
                    } else {
                        Log.w("LoginActivity", "⚠️ user.community is null — no primary community to save")
                    }



                    if (loginResponse != null && user != null && !user._id.isNullOrEmpty() && !token.isNullOrEmpty()) {

                        // 1. Save Token using TokenManager
                        TokenManager.saveToken(this@LoginActivity, token)
                        if (refreshToken != null) {
                            TokenManager.saveRefreshToken(this@LoginActivity, refreshToken)
                        }

                        // 2. Save MongoDB User ID
                        userViewModel.saveLoggedInMongoDbUserIdToTokenManager(user._id)

                        // ✅ 3. Save full user JSON for offline role & permission checks
                        try {
                            val userJson = JSONObject().apply {
                                put("_id", user._id)
                                put("username", user.username ?: "")
                                put("role", user.role ?: "user")
                                put("verified", user.verified)
                                put("profileImage", user.profileImage ?: "")
                                put("email", user.email ?: "")
                                put("phone", user.phone ?: "")
                                put("community", user.community ?: JSONObject.NULL)
                                put("coinsBalance", user.coinsBalance ?: 0)

                                // Permissions computed dynamically
                                val roleName = user.role?.name ?: "user"
                                val verified = user.verified

                                val permissionsJson = JSONObject().apply {
                                    put("canPost", UserPermissions.canPost(roleName, verified))
                                    put("canApprovePost", UserPermissions.canApprove(roleName))
                                    put("canSuspendUser", UserPermissions.canSuspend(roleName))
                                    put("canAssignRoles", UserPermissions.canAssignRoles(roleName))
                                    put("canRevoke", UserPermissions.canRevoke(roleName))
                                }
                                put("permissions", permissionsJson)
                            }.toString()


                            TokenManager.saveUserJson(this@LoginActivity, userJson)
                            Log.i("LoginActivity", "🧩 Full user JSON saved successfully for offline permission checks.")
                        } catch (e: Exception) {
                            Log.e("LoginActivity", "💥 Failed to save user JSON: ${e.message}", e)
                        }

                        Log.i("LoginActivity", "✅ Login successful for: ${user.username}")
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()

                        // --- 👇 OneSignal setup ---
                        Log.d("LoginActivity", "Attempting to set OneSignal External User ID. AppUserID: ${user._id}")
                        if (user._id.isNotEmpty()) {
                            com.example.yenkasachat.util.OneSignalHelper.setOneSignalExternalUserId(
                                applicationContext,
                                user._id
                            )
                        } else {
                            Log.e("LoginActivity", "App Specific User ID is null or empty after login. Cannot set OneSignal External User ID.")
                        }

                        // --- 👇 Player ID update ---
                        val oneSignalPlayerId = OneSignal.getDeviceState()?.userId
                        if (!oneSignalPlayerId.isNullOrBlank()) {
                            Log.i("LoginActivity", "OneSignal Player ID found: $oneSignalPlayerId. Attempting to update via ViewModel.")
                            userViewModel.updateUserPlayerId(oneSignalPlayerId)
                        } else {
                            Log.w("LoginActivity", "OneSignal Player ID not available at login. Will attempt update later if needed.")
                        }

                        // --- 👇 Connect socket ---
                        val userId = user._id
                        if (!userId.isNullOrEmpty()) {
                            SocketManager.connect(userId)
                            Log.i("LoginActivity", "🟢 Socket connected for userId: $userId (online status active)")
                        } else {
                            Log.w("LoginActivity", "⚠️ Cannot connect socket - userId is null or empty.")
                        }

                        // --- 👇 Move to main screen ---
                        val intent = Intent(this@LoginActivity, MainActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                        }
                        startActivity(intent)
                        finish()

                    } else {
                        var errorMessage = "Login failed: "
                        if (token.isNullOrEmpty()) errorMessage += "Missing token. "
                        if (user == null || user._id.isNullOrEmpty()) errorMessage += "Incomplete user info."
                        Log.e("LoginActivity","❌ Login successful HTTP, but incomplete data: $errorMessage")
                        Toast.makeText(this@LoginActivity, errorMessage.trim(), Toast.LENGTH_LONG).show()
                    }
                } else {
                    val errorBody = response.errorBody()?.string() ?: "Unknown error"
                    Log.e("LoginActivity","❌ Login request failed. Code: ${response.code()}, Message: ${response.message()}, ErrorBody: $errorBody")
                    Toast.makeText(this@LoginActivity, "Login failed: ${response.message()} (${response.code()})", Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                Log.e("LoginActivity", "❌ Network error or other failure: ${t.message}", t)
                Toast.makeText(this@LoginActivity, "Network error: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }
}
