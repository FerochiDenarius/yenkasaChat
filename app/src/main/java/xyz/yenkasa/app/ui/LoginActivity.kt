package xyz.yenkasa.app.ui

// Keep all your imports
import android.content.Intent
import android.graphics.Rect
import android.os.Bundle
import android.util.Log
import android.view.animation.AnimationUtils
import android.view.WindowManager
import android.widget.*
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Observer
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LoginRequest
import xyz.yenkasa.app.model.LoginResponse
import xyz.yenkasa.app.model.TrackLoginResponse
import com.google.android.material.textfield.TextInputEditText
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.AppLinkManager
import xyz.yenkasa.app.util.OneSignalHelper
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UpdateManager
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
    private lateinit var btnLogin: View
    private lateinit var textRegisterLink: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var loginCard: View
    private lateinit var loginRoot: View
    private lateinit var loginScroll: ScrollView
    private var updateManager: UpdateManager? = null


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
            val mainIntent = Intent(this, MainActivity::class.java)
            AppLinkManager.copyPendingDeepLink(intent, mainIntent)
            startActivity(mainIntent)
            finish()
            return
        }

        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        )
        setContentView(R.layout.activity_login)
        updateManager = UpdateManager(this)
        updateManager?.checkForUpdates(source = "login_screen")

        // UI elements
        editIdentifier = findViewById(R.id.editLoginIdentifier)
        editPassword = findViewById(R.id.editLoginPassword)
        btnLogin = findViewById(R.id.btnLogin)
        textRegisterLink = findViewById(R.id.textRegisterLink)
        progressBar = findViewById(R.id.loginProgress)
        loginRoot = findViewById(R.id.login_root)
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
            .setOnClickListener {
                val registerIntent = Intent(this, RegisterActivity::class.java)
                AppLinkManager.copyPendingDeepLink(intent, registerIntent)
                startActivity(registerIntent)
            }
        findViewById<TextView>(R.id.textForgotPassword)
            .setOnClickListener {
                val forgotPasswordIntent = Intent(this, ForgotPasswordActivity::class.java)
                AppLinkManager.copyPendingDeepLink(intent, forgotPasswordIntent)
                startActivity(forgotPasswordIntent)
            }

        // Player ID update observer
        userViewModel.playerIdUpdateResult.observe(this, Observer { success ->
            if (success) Log.i("LoginActivity", "Player ID updated.")
        })
    }

    private fun setupKeyboardAwareScrolling() {
        val originalScrollBottomPadding = loginScroll.paddingBottom
        var wasKeyboardVisible = false

        ViewCompat.setOnApplyWindowInsetsListener(loginRoot) { _, insets ->
            val isKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val keyboardOffset = if (isKeyboardVisible) {
                getKeyboardOverlapHeight()
            } else {
                0
            }

            loginScroll.setPadding(
                loginScroll.paddingLeft,
                loginScroll.paddingTop,
                loginScroll.paddingRight,
                originalScrollBottomPadding + keyboardOffset
            )

            if (isKeyboardVisible) {
                val focusedField = currentFocus?.takeIf {
                    it == editIdentifier || it == editPassword
                }
                if (focusedField != null && !wasKeyboardVisible) {
                    scrollFocusedFieldIntoView(focusedField)
                }
            }
            wasKeyboardVisible = isKeyboardVisible

            insets
        }
        ViewCompat.requestApplyInsets(loginRoot)

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
            val visibleArea = Rect()
            view.getDrawingRect(visibleArea)
            loginScroll.offsetDescendantRectToMyCoords(view, visibleArea)

            val topSpacing = (24 * resources.displayMetrics.density).toInt()
            val targetScrollY = (visibleArea.top - topSpacing).coerceAtLeast(0)
            loginScroll.smoothScrollTo(0, targetScrollY)
        }, 300)
    }

    private fun getKeyboardOverlapHeight(): Int {
        val visibleFrame = Rect()
        loginRoot.getWindowVisibleDisplayFrame(visibleFrame)

        val rootLocation = IntArray(2)
        loginRoot.getLocationOnScreen(rootLocation)
        val rootBottom = rootLocation[1] + loginRoot.height

        return (rootBottom - visibleFrame.bottom).coerceAtLeast(0)
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
            editIdentifier.error = getString(R.string.error_identifier_required)
            shakeCard()
            return
        }
        if (password.isEmpty()) {
            editPassword.error = getString(R.string.error_password_required)
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
                    Toast.makeText(this@LoginActivity, getString(R.string.login_failed), Toast.LENGTH_LONG).show()
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
                    trackDailyLogin(token)

                    userViewModel.saveLoggedInMongoDbUserIdToTokenManager(user._id)

                    val roleName = user.roleName ?: user.role?.name ?: if (user.verified) "verified" else "unverified"

                    val userJson = JSONObject().apply {
                        put("_id", user._id)
                        put("username", user.username ?: "")
                        put("role", roleName)
                        put("roleName", roleName)
                        put("accessRole", user.accessRole ?: "")
                        put("staffRole", user.staffRole ?: "")
                        put("publicRoles", org.json.JSONArray(user.publicRoles))
                        put("verified", user.verified)
                        put("profileImage", user.profileImage ?: "")
                        put("email", user.email ?: "")
                        put("phone", user.phone ?: "")
                    }.toString()

                    TokenManager.saveUserJson(this@LoginActivity, userJson)

                    val oneSignalId = OneSignal.getDeviceState()?.userId
                        ?: TokenManager.getOneSignalPlayerId(this@LoginActivity)
                    if (!oneSignalId.isNullOrEmpty()) {
                        userViewModel.updateUserPlayerId(oneSignalId)
                        OneSignalHelper.setOneSignalExternalUserId(this@LoginActivity, user._id)
                    } else {
                        Log.w("LoginActivity", "OneSignal Player ID not available at login; app startup/subscription observer will retry.")
                    }
                    OneSignalHelper.syncCurrentPlayerIdToBackend(this@LoginActivity, "login_success")
                    OneSignalHelper.schedulePlayerIdSyncRetries(this@LoginActivity, "login_success")

                    SocketManager.connect(user._id)

                    if (!TokenManager.hasAcceptedPolicies(this@LoginActivity)) {
                        val policyIntent = Intent(this@LoginActivity, PolicyDisclosureActivity::class.java)
                        AppLinkManager.copyPendingDeepLink(intent, policyIntent)
                        startActivity(policyIntent)
                    } else {
                        val mainIntent = Intent(this@LoginActivity, MainActivity::class.java)
                            .putExtra(MainActivity.EXTRA_CHECK_UPDATES_AFTER_LOGIN, true)
                        AppLinkManager.copyPendingDeepLink(intent, mainIntent)
                        startActivity(mainIntent)
                    }
                    finish()

                } else {
                    shakeCard()
                    Toast.makeText(this@LoginActivity, getString(R.string.invalid_credentials), Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<LoginResponse>, t: Throwable) {
                progressBar.visibility = View.GONE
                btnLogin.isEnabled = true
                shakeCard()
                Toast.makeText(this@LoginActivity, getString(R.string.network_error), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun shakeCard() {
        loginCard.startAnimation(AnimationUtils.loadAnimation(this, R.anim.shake))
    }

    private fun trackDailyLogin(token: String) {
        ApiClient.apiService.trackLogin("Bearer $token")
            .enqueue(object : Callback<TrackLoginResponse> {
                override fun onResponse(
                    call: Call<TrackLoginResponse>,
                    response: Response<TrackLoginResponse>
                ) {
                    if (!response.isSuccessful) {
                        Log.w("LoginActivity", "Daily login tracking failed: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                    Log.w("LoginActivity", "Daily login tracking failed: ${t.message}")
                }
            })
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (updateManager?.onActivityResult(requestCode, resultCode) == true) {
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        updateManager?.destroy()
        super.onDestroy()
    }
}
