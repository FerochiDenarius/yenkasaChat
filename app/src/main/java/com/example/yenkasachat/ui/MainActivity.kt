package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.fragment.app.Fragment
import com.example.yenkasachat.R
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton

class MainActivity : AppCompatActivity() {

    private lateinit var userId: String
    private lateinit var token: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // ✅ Setup Toolbar
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.title = "Yenkasa Feed"

        // ✅ Token Validation
        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        token = retrievedToken
        userId = retrievedUserId

        // ✅ Load FeedActivity content inside MainActivity container
        if (savedInstanceState == null) {
            replaceFragment(FeedContainerFragment())
        }

        // ✅ Floating Action Button → Create Post
        val fabAddPost = findViewById<FloatingActionButton>(R.id.btnAddPost)
        fabAddPost.setOnClickListener {
            val isVerified = getSharedPreferences("auth", MODE_PRIVATE)
                .getBoolean("verified", false)

            if (isVerified) {
                startActivity(Intent(this, PostActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    "You must verify your account before posting.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    // ✅ Replace the content area dynamically
    private fun replaceFragment(fragment: Fragment) {
        supportFragmentManager.beginTransaction()
            .replace(R.id.mainContainer, fragment)
            .commit()
    }

    // ✅ Inflate top-right toolbar menu (3-dots)
    override fun onCreateOptionsMenu(menu: android.view.Menu?): Boolean {
        menuInflater.inflate(R.menu.toolbar_menu, menu)
        return true
    }

    // ✅ Handle menu clicks
    override fun onOptionsItemSelected(item: android.view.MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_open_menu -> {
                startActivity(Intent(this, MenuActivity::class.java))
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
