package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.util.TokenManager

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

        // ✅ Account Info
        findViewById<Button>(R.id.btnAccount).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }

        // ⚠️ Verify Account — placeholder until your VerifyAccountActivity exists
        findViewById<Button>(R.id.btnVerifyAccount).setOnClickListener {
            Toast.makeText(this, "Verify Account feature coming soon!", Toast.LENGTH_SHORT).show()
        }

        // ⚙️ Settings — placeholder until SettingsActivity exists
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
    }
}
