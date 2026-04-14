package xyz.yenkasa.app.ui

// Keep all your imports
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.animation.AnimationUtils
import android.view.WindowManager
import android.widget.*
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Observer
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LoginRequest
import xyz.yenkasa.app.model.LoginResponse
import com.google.android.material.textfield.TextInputEditText
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.viewmodel.UserViewModel
import xyz.yenkasa.app.network.SocketManager
import com.onesignal.OneSignal
import org.json.JSONObject
import android.view.View
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var editIdentifier: EditText
    private lateinit var editPassword: TextInputEditText
    private lateinit var btnLogin: Button
    private lateinit var textRegisterLink: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var loginCard: View
    private lateinit var loginScroll: ScrollView


    private val userViewModel: UserViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (TokenManager.isFirstLaunch(this)) {
            startActivity(Intent(this, IntroActivity::class.java))
            finish()
            return
        }


        val existingToken = TokenManager.getToken(this)
        val existingUserId = TokenManager.getUserId(this)

        if (!existingToken.isNullOrEmpty() && !existingUserId.isNullOrEmpty()) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_login)
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        )

        // UI elements
        editIdentifier = findViewById(R.id.editLoginIdentifier)
        editPassword = findViewById(R.id.editLoginPassword)
        btnLogin = findViewById(R.id.btnLogin)
        textRegisterLink = findViewById(R.id.textRegisterLink)
        progressBar = findViewById(R.id.loginProgress)
        loginCard = findViewById(R.id.loginCard)
        loginScroll = findViewById(R.id.loginScroll)

        // Entrance animation
        loginCard.startAnimation(AnimationUtils.loadAnimation(this, R.anim.slide_up_fade))

        // Add star sparkle animation
        addStarSparkle()

        // Click events
        btnLogin.setOnClickListener { handleLogin() }
        setupKeyboardAwareScrolling()
        findViewById<TextView>(R.id.textRegisterLink)
            .setOnClickListener { startActivity(Intent(this, RegisterActivity::class.java)) }
        findViewById<TextView>(R.id.textForgotPassword)
            .setOnClickListener { startActivity(Intent(this, ForgotPasswordActivity::class.java)) }

        // Player ID update observer
        userViewModel.playerIdUpdateResult.observe(this, Observer { success ->
            if (success) Log.i("LoginActivity", "Player ID updated.")
        })
    }

    private fun setupKeyboardAwareScrolling() {
        val focusListener = View.OnFocusChangeListener { view, hasFocus ->
            if (hasFocus) {
                scrollFocusedFieldIntoView(view)
            }
        }

        editIdentifier.onFocusChangeListener = focusListener
        editPassword.onFocusChangeListener = focusListener
        editIdentifier.setOnClickListener { scrollFocusedFieldIntoView(editIdentifier) }
        editPassword.setOnClickListener { scrollFocusedFieldIntoView(editPassword) }
    }

    private fun scrollFocusedFieldIntoView(view: View) {
        loginScroll.postDelayed({
            val visibleArea = android.graphics.Rect()
            view.getDrawingRect(visibleArea)
            loginScroll.offsetDescendantRectToMyCoords(view, visibleArea)

            val topSpacing = (24 * resources.displayMetrics.density).toInt()
            val targetScrollY = (visibleArea.top - topSpacing).coerceAtLeast(0)
            loginScroll.smoothScrollTo(0, targetScrollY)
        }, 300)
    }

    private fun addStarSparkle() {
        val starContainer = findViewById<FrameLayout>(R.id.starContainer)
        val sparkleAnim = AnimationUtils.loadAnimation(this, R.anim.star_sparkle)

        // Random sparkle on each child every few seconds
        starContainer.post {
            for (i in 0 until starContainer.childCount) {
                val star = starContainer.getChildAt(i)
                star.startAnimation(sparkleAnim)
            }
        }
    }

    private fun handleLogin() {
        val identifier = editIdentifier.text.toString().trim()
        val password = editPassword.text.toString()

        if (identifier.isEmpty()) {
            editIdentifier.error = "Identifier cannot be empty"
            shakeCard()
            return
        }
        if (password.isEmpty()) {
            editPassword.error = "Password cannot be empty"
            shakeCard()
            return
        }

        // Show loader
        progressBar.visibility = View.VISIBLE
        btnLogin.isEnabled = false

        val request = LoginRequest(identifier, password)

        ApiClient.authService.login(request).enqueue(object : Callback<LoginResponse> {

            override fun onResponse(call: Call<LoginResponse>, response: Response<LoginResponse>) {

                // Hide loader
                progressBar.visibility = View.GONE
                btnLogin.isEnabled = true

                if (!response.isSuccessful) {
                    shakeCard()
                    Toast.makeText(this@LoginActivity, "Login failed", Toast.LENGTH_LONG).show()
                    return
                }

                // YOUR ORIGINAL SUCCESS LOGIC (UNCHANGED)
                // ----------------------------------------------------
                val loginResponse = response.body()
                val user = loginResponse?.user
                val token = loginResponse?.token
                val refreshToken = loginResponse?.refreshToken

                if (loginResponse != null && user != null && !user._id.isNullOrEmpty() && !token.isNullOrEmpty()) {

                    TokenManager.saveToken(this@LoginActivity, token)
                    if (refreshToken != null) TokenManager.saveRefreshToken(this@LoginActivity, refreshToken)

                    userViewModel.saveLoggedInMongoDbUserIdToTokenManager(user._id)

                    val userJson = JSONObject().apply {
                        put("_id", user._id)
                        put("username", user.username ?: "")
                        put("role", user.role ?: "user")
                        put("verified", user.verified)
                        put("profileImage", user.profileImage ?: "")
                        put("email", user.email ?: "")
                        put("phone", user.phone ?: "")
                    }.toString()

                    TokenManager.saveUserJson(this@LoginActivity, userJson)

                    val oneSignalId = OneSignal.getDeviceState()?.userId
                    if (!oneSignalId.isNullOrEmpty()) userViewModel.updateUserPlayerId(oneSignalId)

                    SocketManager.connect(user._id)

                    if (!TokenManager.hasAcceptedPolicies(this@LoginActivity)) {
                        startActivity(Intent(this@LoginActivity, PolicyDisclosureActivity::class.java))
                    } else {
                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                    }
                    finish()

                } else {
                    shakeCard()
                    Toast.makeText(this@LoginActivity, "Invalid credentials", Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                progressBar.visibility = View.GONE
                btnLogin.isEnabled = true
                shakeCard()
                Toast.makeText(this@LoginActivity, "Network error", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun shakeCard() {
        loginCard.startAnimation(AnimationUtils.loadAnimation(this, R.anim.shake))
    }
}
