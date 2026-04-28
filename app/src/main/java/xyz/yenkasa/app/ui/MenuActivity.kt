package xyz.yenkasa.app.ui

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CoinBalanceResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import xyz.yenkasa.app.util.WalletBalanceManager
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MenuActivity : AppCompatActivity() {

    private val TAG = "MenuActivity"
    private lateinit var textMenuWalletBalance: TextView
    private var balanceReceiverRegistered = false

    private val balanceUpdateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WalletBalanceManager.ACTION_BALANCE_UPDATED) return
            val balance = intent.getIntExtra(WalletBalanceManager.EXTRA_BALANCE, TokenManager.getCoins(this@MenuActivity))
            textMenuWalletBalance.text = "$balance YKC"
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_menu)
        window.statusBarColor = ContextCompat.getColor(this, R.color.menu_background)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.menu_background)
        val isNightMode = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        if (!isNightMode) {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        Log.d(TAG, "MenuActivity started")

        // All menu items are LinearLayouts (NOT Buttons anymore)
        val btnContacts = findViewById<LinearLayout>(R.id.btnContacts)
        val btnChatRooms = findViewById<LinearLayout>(R.id.btnChatRooms)
        val btnCoinWallet = findViewById<LinearLayout>(R.id.btnCoinWallet)
        val btnAppVerification = findViewById<LinearLayout>(R.id.btnAppVerification)
        val btnAccount = findViewById<LinearLayout>(R.id.btnAccount)
        val btnEditProfile = findViewById<LinearLayout>(R.id.btnEditProfile)
        val btnVerifyAccount = findViewById<LinearLayout>(R.id.btnVerifyAccount)
        val btnSettings = findViewById<LinearLayout>(R.id.btnSettings)
        val btnPostApproval = findViewById<LinearLayout>(R.id.btnPostApproval)
        val btnMyAds = findViewById<LinearLayout>(R.id.btnMyAds)
        val btnMyCommunities = findViewById<LinearLayout>(R.id.btnMyCommunities)
        val btnAdsApproval = findViewById<LinearLayout>(R.id.btnAdsApproval)
        val btnCommunityApproval = findViewById<LinearLayout>(R.id.btnCommunityApproval)
        val btnLogout = findViewById<LinearLayout>(R.id.btnLogout)
        val btnCommunities = findViewById<LinearLayout>(R.id.btnCommunities)
        val btnNotifications = findViewById<LinearLayout>(R.id.btnNotifications)
        val walletBalanceChip = findViewById<LinearLayout>(R.id.walletBalanceChip)
        textMenuWalletBalance = findViewById(R.id.textMenuWalletBalance)
        val canReview = UserPermissions.canApprove(resolveCurrentRole())

        btnAdsApproval.visibility = if (canReview) View.VISIBLE else View.GONE
        btnCommunityApproval.visibility = if (canReview) View.VISIBLE else View.GONE

        textMenuWalletBalance.text = "${TokenManager.getCoins(this)} YKC"
        loadWalletBalance()
        walletBalanceChip.visibility = if (isNightMode) View.GONE else View.VISIBLE
        walletBalanceChip.setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }

        // ✔ Contacts
        btnContacts.setOnClickListener {
            Log.d(TAG, "Contacts clicked")
            startActivity(Intent(this, ContactsActivity::class.java))
        }

        // ✔ Chat Rooms
        btnChatRooms.setOnClickListener {
            Log.d(TAG, "ChatRooms clicked")
            startActivity(Intent(this, ChatRoomsActivity::class.java))
        }

        // ✔ Wallet
        btnCoinWallet.setOnClickListener {
            Log.d(TAG, "Wallet clicked")
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }

        // ✔ App Verification
        btnAppVerification.setOnClickListener {
            Log.d(TAG, "AppVerification clicked")
            startActivity(Intent(this, AppVerificationActivity::class.java))
        }

        // ✔ Account Info
        btnAccount.setOnClickListener {
            Log.d(TAG, "AccountInfo clicked")
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }

        // ✔ Edit Profile
        btnEditProfile.setOnClickListener {
            Log.d(TAG, "EditProfile clicked")
            startActivity(Intent(this, EditProfileActivity::class.java))
        }

        // ✔ Verify Account
        btnVerifyAccount.setOnClickListener {
            Log.d(TAG, "VerifyAccount clicked")
            startActivity(Intent(this, VerificationActivity::class.java))
        }


        // ✔ Settings
        btnSettings.setOnClickListener {
            Log.d(TAG, "Settings clicked")
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        // ✔ Post Approval
        btnPostApproval.setOnClickListener {
            Log.d(TAG, "PostApproval clicked")
            startActivity(Intent(this, PostApprovalActivity::class.java))
        }

        btnMyAds.setOnClickListener {
            Log.d(TAG, "MyAds clicked")
            startActivity(Intent(this, MyAdsActivity::class.java))
        }

        btnMyCommunities.setOnClickListener {
            Log.d(TAG, "MyCommunities clicked")
            startActivity(Intent(this, MyCommunitiesActivity::class.java))
        }

        btnAdsApproval.setOnClickListener {
            Log.d(TAG, "AdsApproval clicked")
            startActivity(Intent(this, AdsApprovalActivity::class.java))
        }

        btnCommunityApproval.setOnClickListener {
            Log.d(TAG, "CommunityApproval clicked")
            startActivity(Intent(this, CommunityApprovalActivity::class.java))
        }

        // ✔ Notifications
        btnNotifications.setOnClickListener {
            Log.d(TAG, "Notifications clicked")
            startActivity(Intent(this, UserNotificationsActivity::class.java))
        }

        // ✔ Communities
        btnCommunities.setOnClickListener {
            Log.d(TAG, "Communities clicked")
            startActivity(Intent(this, CommunitiesActivity::class.java))
        }

        // 🚪 Logout
        btnLogout.setOnClickListener {
            Log.d(TAG, "Logout clicked")
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::textMenuWalletBalance.isInitialized) {
            loadWalletBalance()
        }
    }

    override fun onStart() {
        super.onStart()
        if (!balanceReceiverRegistered) {
            ContextCompat.registerReceiver(
                this,
                balanceUpdateReceiver,
                IntentFilter(WalletBalanceManager.ACTION_BALANCE_UPDATED),
                ContextCompat.RECEIVER_NOT_EXPORTED
            )
            balanceReceiverRegistered = true
        }
    }

    override fun onStop() {
        if (balanceReceiverRegistered) {
            unregisterReceiver(balanceUpdateReceiver)
            balanceReceiverRegistered = false
        }
        super.onStop()
    }

    private fun loadWalletBalance() {
        val authToken = TokenManager.getToken(this) ?: return

        ApiClient.apiService.getCoinBalance("Bearer $authToken")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(
                    call: Call<CoinBalanceResponse>,
                    response: Response<CoinBalanceResponse>
                ) {
                    val balance = response.body()?.balance
                    if (response.isSuccessful && balance != null) {
                        TokenManager.saveCoins(this@MenuActivity, balance)
                        textMenuWalletBalance.text = "$balance YKC"
                    } else {
                        textMenuWalletBalance.text = "${TokenManager.getCoins(this@MenuActivity)} YKC"
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    Log.w(TAG, "Failed to load wallet balance: ${t.message}")
                    textMenuWalletBalance.text = "${TokenManager.getCoins(this@MenuActivity)} YKC"
                }
            })
    }

    private fun resolveCurrentRole(): String {
        val userJson = TokenManager.getUser(this)
        if (!userJson.isNullOrBlank()) {
            runCatching {
                val json = JSONObject(userJson)
                json.optString("roleName").takeIf { it.isNotBlank() }?.let { return it }
                when (val roleValue = json.opt("role")) {
                    is JSONObject -> roleValue.optString("name").takeIf { it.isNotBlank() }?.let { return it }
                    is String -> roleValue.takeIf { it.isNotBlank() }?.let { return it }
                }
            }.onFailure {
                Log.w(TAG, "Unable to parse saved role JSON: ${it.message}")
            }
        }
        return TokenManager.getUserRole(this)
    }
}
