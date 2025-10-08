package com.example.yenkasachat.webrtc

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.example.yenkasachat.R
import com.example.yenkasachat.network.*
import com.example.yenkasachat.network.CreateRoomRequest
import com.example.yenkasachat.network.CreateRoomResponse
import com.example.yenkasachat.network.GenerateTokenRequest
import com.example.yenkasachat.network.GenerateTokenResponse


class VideoCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnEndCall: ImageButton
    private lateinit var tvCallStatus: TextView

    private var currentUserId: String? = null

    companion object {
        private const val TAG = "VideoCallActivity"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Bind XML elements
        webView = findViewById(R.id.webview_call)
        webView.settings.javaScriptEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()

        btnEndCall = findViewById(R.id.btn_end_call)
        tvCallStatus = findViewById(R.id.tv_call_status)

        // Get current user ID
        currentUserId = intent.getStringExtra("CURRENT_USER_ID")
        if (currentUserId.isNullOrBlank()) {
            Toast.makeText(this, "Error: Your user ID is not configured.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        btnEndCall.setOnClickListener { endCall() }

        // Permissions check
        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            startDailyCoCall()
        }
    }

    private fun startDailyCoCall() {
        tvCallStatus.text = getString(R.string.call_status_initializing)

        // 1️⃣ Create a Daily.co room
        val roomRequest = CreateRoomRequest("room-${System.currentTimeMillis()}")
        ApiClient.dailyApi.createRoom(roomRequest).enqueue(object : retrofit2.Callback<CreateRoomResponse> {
            override fun onResponse(call: retrofit2.Call<CreateRoomResponse>, response: retrofit2.Response<CreateRoomResponse>) {
                val roomName = response.body()?.roomName
                val roomUrl = response.body()?.roomUrl

                if (roomName.isNullOrEmpty() || roomUrl.isNullOrEmpty()) {
                    Toast.makeText(this@VideoCallActivity, "Failed to create room", Toast.LENGTH_LONG).show()
                    return
                }

                // 2️⃣ Generate token for current user
                val tokenRequest = GenerateTokenRequest(roomName, currentUserId!!)
                ApiClient.dailyApi.generateToken(tokenRequest).enqueue(object : retrofit2.Callback<GenerateTokenResponse> {
                    override fun onResponse(call: retrofit2.Call<GenerateTokenResponse>, tokenResponse: retrofit2.Response<GenerateTokenResponse>) {
                        val token = tokenResponse.body()?.token
                        if (token.isNullOrEmpty()) {
                            Toast.makeText(this@VideoCallActivity, "Failed to generate token", Toast.LENGTH_LONG).show()
                            return
                        }

                        // 3️⃣ Load room in WebView
                        val urlWithToken = "$roomUrl?t=$token"
                        webView.loadUrl(urlWithToken)
                        tvCallStatus.text = getString(R.string.call_status_connected)
                        tvCallStatus.visibility = View.GONE
                    }

                    override fun onFailure(call: retrofit2.Call<GenerateTokenResponse>, t: Throwable) {
                        Toast.makeText(this@VideoCallActivity, "Token generation error: ${t.message}", Toast.LENGTH_LONG).show()
                        Log.e(TAG, "Token generation failed", t)
                    }
                })
            }

            override fun onFailure(call: retrofit2.Call<CreateRoomResponse>, t: Throwable) {
                Toast.makeText(this@VideoCallActivity, "Room creation error: ${t.message}", Toast.LENGTH_LONG).show()
                Log.e(TAG, "Room creation failed", t)
            }
        })
    }

    private fun allPermissionsGranted(): Boolean =
        REQUIRED_PERMISSIONS.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE && allPermissionsGranted()) {
            startDailyCoCall()
        } else {
            Toast.makeText(this, "Camera & Microphone permissions are required.", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    private fun endCall() {
        webView.loadUrl("about:blank")
        finish()
    }
}
