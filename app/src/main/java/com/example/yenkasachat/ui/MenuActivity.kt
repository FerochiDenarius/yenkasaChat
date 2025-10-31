package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.ui.CommunitiesActivity


class MenuActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_menu)

        // ✅ Contacts
        findViewById<Button>(R.id.btnContacts).setOnClickListener {
            startActivity(Intent(this, ContactsActivity::class.java))
        }

        // ✅ Chat Rooms
        findViewById<Button>(R.id.btnChatRooms).setOnClickListener {
            startActivity(Intent(this, ChatRoomsActivity::class.java))
        }

        // ✅ Coin Wallet
        findViewById<Button>(R.id.btnCoinWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }

        // ✅ App Verification
        findViewById<Button>(R.id.btnAppVerification).setOnClickListener {
            startActivity(Intent(this, AppVerificationActivity::class.java))
        }

        // ✅ Account Info
        findViewById<Button>(R.id.btnAccount).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }

        // ✅ Edit Profile
        findViewById<Button>(R.id.btnEditProfile).setOnClickListener {
            startActivity(Intent(this, EditProfileActivity::class.java))
        }

        // ⚠️ Verify Account
        findViewById<Button>(R.id.btnVerifyAccount).setOnClickListener {
            Toast.makeText(this, "Verify Account feature coming soon!", Toast.LENGTH_SHORT).show()
        }

        // ⚙️ Settings
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            Toast.makeText(this, "Settings feature coming soon!", Toast.LENGTH_SHORT).show()
        }

        // 🚪 Logout
        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        // ✅ Communities button — only for admin, verified, moderator, developer
        val btnCommunities = findViewById<Button>(R.id.btnCommunities)
        val hasPrivileges = TokenManager.isAdmin(this)
                || TokenManager.isModerator(this)
                || TokenManager.isDeveloper(this)
                || TokenManager.isVerified(this)

        if (hasPrivileges) {
            btnCommunities.isEnabled = true
            btnCommunities.setOnClickListener {
                startActivity(Intent(this, CommunitiesActivity::class.java))
            }
        } else {
            btnCommunities.isEnabled = false
            btnCommunities.alpha = 0.5f
            btnCommunities.setOnClickListener {
                Toast.makeText(this, "You do not have permission to access Communities", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
