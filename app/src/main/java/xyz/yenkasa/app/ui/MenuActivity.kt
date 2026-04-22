package xyz.yenkasa.app.ui

import android.content.Intent
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
import xyz.yenkasa.app.util.TokenManager

class MenuActivity : AppCompatActivity() {

    private val TAG = "MenuActivity"

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
        val btnLogout = findViewById<LinearLayout>(R.id.btnLogout)
        val btnCommunities = findViewById<LinearLayout>(R.id.btnCommunities)
        val btnNotifications = findViewById<LinearLayout>(R.id.btnNotifications)
        val walletBalanceChip = findViewById<LinearLayout>(R.id.walletBalanceChip)
        val textMenuWalletBalance = findViewById<TextView>(R.id.textMenuWalletBalance)

        textMenuWalletBalance.text = "${TokenManager.getCoins(this)} YKC"
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
}
