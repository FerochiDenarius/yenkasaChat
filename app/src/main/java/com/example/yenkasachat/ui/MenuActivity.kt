package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.util.TokenManager

class MenuActivity : AppCompatActivity() {

    private val TAG = "MenuActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_menu)

        Log.d(TAG, "MenuActivity started")

        // ✅ Contacts
        findViewById<Button>(R.id.btnContacts).setOnClickListener {
            Log.d(TAG, "Contacts button clicked")
            startActivity(Intent(this, ContactsActivity::class.java))
        }

        // ✅ Chat Rooms
        findViewById<Button>(R.id.btnChatRooms).setOnClickListener {
            Log.d(TAG, "ChatRooms button clicked")
            startActivity(Intent(this, ChatRoomsActivity::class.java))
        }

        // ✅ Coin Wallet
        findViewById<Button>(R.id.btnCoinWallet).setOnClickListener {
            Log.d(TAG, "CoinWallet button clicked")
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }

        // ✅ App Verification
        findViewById<Button>(R.id.btnAppVerification).setOnClickListener {
            Log.d(TAG, "AppVerification button clicked")
            startActivity(Intent(this, AppVerificationActivity::class.java))
        }

        // ✅ Account Info
        findViewById<Button>(R.id.btnAccount).setOnClickListener {
            Log.d(TAG, "AccountInfo button clicked")
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }

        // ✅ Edit Profile
        findViewById<Button>(R.id.btnEditProfile).setOnClickListener {
            Log.d(TAG, "EditProfile button clicked")
            startActivity(Intent(this, EditProfileActivity::class.java))
        }

        // ⚠️ Verify Account
        findViewById<Button>(R.id.btnVerifyAccount).setOnClickListener {
            Log.d(TAG, "VerifyAccount button clicked")
            Toast.makeText(this, "Verify Account feature coming soon!", Toast.LENGTH_SHORT).show()
        }

        // ⚙️ Settings
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            Log.d(TAG, "Settings button clicked")
            Toast.makeText(this, "Settings feature coming soon!", Toast.LENGTH_SHORT).show()
        }

        // 🚪 Logout
        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            Log.d(TAG, "Logout button clicked")
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        // ✅ Communities button — only for admin, verified, moderator, developer
        val btnCommunities = findViewById<Button>(R.id.btnCommunities)
        val isAdmin = TokenManager.isAdmin(this)
        val isModerator = TokenManager.isModerator(this)
        val isDeveloper = TokenManager.isDeveloper(this)
        val isVerified = TokenManager.isVerified(this)

        Log.d(TAG, "Checking privileges - Admin: $isAdmin, Moderator: $isModerator, Developer: $isDeveloper, Verified: $isVerified")

        val hasPrivileges = isAdmin || isModerator || isDeveloper || isVerified

        if (hasPrivileges) {
            Log.d(TAG, "User has privileges — enabling Communities button")
            btnCommunities.isEnabled = true
            btnCommunities.alpha = 1.0f
            btnCommunities.setOnClickListener {
                Log.d(TAG, "Communities button clicked - opening CommunitiesActivity")
                startActivity(Intent(this, CommunitiesActivity::class.java))
            }
        } else {
            Log.d(TAG, "User does NOT have privileges — disabling Communities button")
            btnCommunities.isEnabled = false
            btnCommunities.alpha = 0.5f
            btnCommunities.setOnClickListener {
                Log.d(TAG, "Communities button clicked without permission")
                Toast.makeText(this, "You do not have permission to access Communities", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
