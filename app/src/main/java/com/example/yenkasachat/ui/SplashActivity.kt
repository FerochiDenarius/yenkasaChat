package com.example.yenkasachat.ui

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            Log.d("SplashActivity", "🔔 POST_NOTIFICATIONS permission granted? $granted")
            if (!granted) {
                requestPermissions(
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    REQUEST_CODE_POST_NOTIFICATIONS
                )
            } else {
                proceedAfterPermission()
            }
        } else {
            proceedAfterPermission()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CODE_POST_NOTIFICATIONS) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted) {
                Log.d("SplashActivity", "✅ Notification permission granted by user")
            } else {
                Log.w("SplashActivity", "🔕 Notification permission denied by user")
            }
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
