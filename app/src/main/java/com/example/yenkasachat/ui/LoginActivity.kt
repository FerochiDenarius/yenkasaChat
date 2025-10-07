package com.example.yenkasachat.ui

// Keep your existing imports
import android.content.Context
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
import com.example.yenkasachat.util.OneSignalHelper // <--- Add this if not present
import com.example.yenkasachat.viewmodel.UserViewModel // Import UserViewModel
import com.onesignal.OneSignal
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInClient
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.google.firebase.auth.FirebaseAuth
import com.google.android.gms.common.SignInButton
import com.google.firebase.auth.GoogleAuthProvider


class LoginActivity : AppCompatActivity() {

    private lateinit var editIdentifier: EditText
    private lateinit var editPassword: TextInputEditText
    private lateinit var btnLogin: Button
    private lateinit var textRegisterLink: TextView
    private lateinit var googleSignInClient: GoogleSignInClient
    private lateinit var auth: FirebaseAuth
    private val RC_SIGN_IN = 1001
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

        // 🔹 Google Sign-In setup
        auth = FirebaseAuth.getInstance()

        val gso = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(getString(R.string.default_web_client_id)) // from google-services.json
            .requestEmail()
            .build()

        googleSignInClient = GoogleSignIn.getClient(this, gso)

        val googleSignInButton: SignInButton = findViewById(R.id.btnGoogleSignIn)
        googleSignInButton.setOnClickListener {
            signInWithGoogle()
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
    private fun signInWithGoogle() {
        val signInIntent = googleSignInClient.signInIntent
        startActivityForResult(signInIntent, RC_SIGN_IN)
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

        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {
            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {
                if (response.isSuccessful) {
                    val loginResponse = response.body()
                    val user = loginResponse?.user
                    val token = loginResponse?.token
                    val refreshToken = loginResponse?.refreshToken

                    if (loginResponse != null && user != null && !user._id.isNullOrEmpty() && !token.isNullOrEmpty()) {

                        // 1. Save Token using TokenManager
                        TokenManager.saveToken(this@LoginActivity, token)
                        if (refreshToken != null) {
                            TokenManager.saveRefreshToken(this@LoginActivity, refreshToken)
                        }

                        // 2. Save MongoDB User ID
                        userViewModel.saveLoggedInMongoDbUserIdToTokenManager(user._id)

                        Log.d("LoginActivity","🔐 Token saved via TokenManager.")
                        Log.d("LoginActivity","🪪 UserID saved via UserViewModel (using TokenManager): ${user._id}")

                        Log.i("LoginActivity", "✅ Login successful for: ${user.username}")
                        Toast.makeText(this@LoginActivity, "Login successful", Toast.LENGTH_SHORT).show()

                        // --- 👇 ADDED SECTION ---
                        Log.d("LoginActivity", "Attempting to set OneSignal External User ID. AppUserID: ${user._id}")
                        if (user._id.isNotEmpty()) {
                            com.example.yenkasachat.util.OneSignalHelper.setOneSignalExternalUserId(
                                applicationContext,
                                user._id
                            )
                        } else {
                            Log.e("LoginActivity", "App Specific User ID is null or empty after login. Cannot set OneSignal External User ID.")
                        }
                        // --- 👆 END OF ADDED SECTION ---

                        // 3. Get OneSignal Player ID and update it via UserViewModel
                        val oneSignalPlayerId = OneSignal.getDeviceState()?.userId
                        if (oneSignalPlayerId != null && oneSignalPlayerId.isNotBlank()) {
                            Log.i("LoginActivity", "OneSignal Player ID found: $oneSignalPlayerId. Attempting to update via ViewModel.")
                            userViewModel.updateUserPlayerId(oneSignalPlayerId)
                        } else {
                            Log.w("LoginActivity", "OneSignal Player ID not available at login. Will attempt update later if needed.")
                        }
// --- 👇 CONNECT SOCKET AFTER LOGIN SUCCESS ---
                        val userId = user._id
                        if (!userId.isNullOrEmpty()) {
                            SocketManager.connect(userId)
                            Log.i("LoginActivity", "🟢 Socket connected for userId: $userId (online status active)")
                        } else {
                            Log.w("LoginActivity", "⚠️ Cannot connect socket - userId is null or empty.")
                        }
// --- 👆 END SOCKET CONNECTION ---

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
