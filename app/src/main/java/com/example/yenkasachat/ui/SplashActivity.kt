package com.example.yenkasachat.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R

class SplashActivity : AppCompatActivity() {

    private val REQUEST_CODE_POST_NOTIFICATIONS = 101

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        checkAndRequestNotificationPermission()
    }

    private fun checkAndRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // Android 13+
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), REQUEST_CODE_POST_NOTIFICATIONS)
            } else {
                proceedAfterPermission()
            }
        } else {
            proceedAfterPermission()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_POST_NOTIFICATIONS) {
            // You can check if granted or not, but proceed anyway
            proceedAfterPermission()
        }
    }

    private fun proceedAfterPermission() {
        Handler(Looper.getMainLooper()).postDelayed({
            val prefs = getSharedPreferences("auth", MODE_PRIVATE)
            val token = prefs.getString("token", null)
            val userId = prefs.getString("userId", null)

            if (!token.isNullOrEmpty() && !userId.isNullOrEmpty()) {
                startActivity(Intent(this, MainActivity::class.java))
            } else {
                startActivity(Intent(this, LoginActivity::class.java))
            }
            finish()
        }, 2000) // 2 seconds delay
    }
}
