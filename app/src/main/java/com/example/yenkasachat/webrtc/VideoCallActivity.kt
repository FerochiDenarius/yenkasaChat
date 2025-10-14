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
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.os.Build
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.CreateRoomRequest
import com.example.yenkasachat.network.GenerateTokenRequest
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.network.DailyApiClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException

class VideoCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnEndCall: ImageButton
    private lateinit var tvCallStatus: TextView

    private val webSocketManager = WebSocketManager()

    private var currentUserId: String? = null
    private var receiverId: String? = null
    private var isCaller: Boolean = false
    private var isVideoCall: Boolean = true
    private var callAccepted = false

    companion object {
        private const val TAG = "VideoCallActivity"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        private const val DAILY_DOMAIN = "https://your-daily-domain.daily.co" // replace with your domain
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // --- Bind views ---
        webView = findViewById(R.id.webview_call)
        btnEndCall = findViewById(R.id.btn_end_call)
        tvCallStatus = findViewById(R.id.tv_call_status)

        webView.settings.javaScriptEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()

        // ✅ Grant WebView access to camera and microphone automatically
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        request.grant(request.resources)
                        Log.d("VideoCallActivity", "✅ WebView permissions granted for: ${request.resources.joinToString()}")
                    }
                }
            }
        }


        // --- Intent data ---
        currentUserId = intent.getStringExtra("CURRENT_USER_ID")
        receiverId = intent.getStringExtra("RECEIVER_ID")
        isCaller = intent.getBooleanExtra("IS_CALLER", false)
        isVideoCall = intent.getBooleanExtra("IS_VIDEO_CALL", true)

        if (currentUserId.isNullOrBlank() || receiverId.isNullOrBlank()) {
            Toast.makeText(this, "Missing user IDs", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        // --- WebSocket connect ---
        webSocketManager.connect(this)

        // --- End button ---
        btnEndCall.setOnClickListener { endCall() }

        // --- Permissions ---
        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            if (isCaller) {
                startOutgoingCall()
            } else {
                listenForIncomingCall()
            }
        }
    }

    // ✅ Permissions
    private fun allPermissionsGranted(): Boolean =
        REQUIRED_PERMISSIONS.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE && allPermissionsGranted()) {
            if (isCaller) startOutgoingCall() else listenForIncomingCall()
        } else {
            Toast.makeText(this, "Camera & Microphone permissions required", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    // ✅ Outgoing call
    private fun startOutgoingCall() {
        tvCallStatus.text = "Calling..."
        webSocketManager.sendCallRequest(receiverId!!, isVideoCall)
        setupDailyRoomAndJoin()
    }

    // ✅ Incoming call listener
    private fun listenForIncomingCall() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { msg ->
                when (msg.type) {
                    SignalingMessageType.CALL_REQUEST -> {
                        showIncomingCallDialog(msg.fromUserId ?: "Unknown")
                    }
                    SignalingMessageType.CALL_ACCEPT -> {
                        onCallAccepted()
                        setupDailyRoomAndJoin()
                    }
                    SignalingMessageType.CALL_REJECT -> {
                        onCallRejected()
                    }
                    else -> {}
                }
            }
        }
    }

    private fun showIncomingCallDialog(callerId: String) {
        runOnUiThread {
            if (callAccepted) return@runOnUiThread

            AlertDialog.Builder(this)
                .setTitle(if (isVideoCall) "Incoming Video Call" else "Incoming Audio Call")
                .setMessage("Call from $callerId")
                .setPositiveButton("Accept") { dialog, _ ->
                    callAccepted = true
                    webSocketManager.sendSignalingMessage("call_accept", callerId)
                    setupDailyRoomAndJoin()
                    dialog.dismiss()
                }
                .setNegativeButton("Reject") { dialog, _ ->
                    webSocketManager.sendSignalingMessage("call_reject", callerId)
                    finish()
                    dialog.dismiss()
                }
                .setCancelable(false)
                .show()
        }
    }

    // ✅ Join or create Daily room via Retrofit API
    private fun setupDailyRoomAndJoin() {
        val apiService = DailyApiClient.service
        val roomName = if (currentUserId!! < receiverId!!) {
            "call_${currentUserId}_$receiverId"
        } else {
            "call_${receiverId}_$currentUserId"
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                // Step 1: Create room
                val createRes = apiService.createRoom(CreateRoomRequest(roomName)).execute()
                if (!createRes.isSuccessful || createRes.body() == null) {
                    Log.e(TAG, "❌ Room creation failed: ${createRes.errorBody()?.string()}")
                    showToast("Failed to create room.")
                    return@launch
                }
                val room = createRes.body()!!
                Log.d(TAG, "✅ Room created: ${room.roomUrl}")

                // Step 2: Generate token
                val tokenRes = apiService.generateToken(GenerateTokenRequest(room.roomName, currentUserId!!)).execute()
                if (!tokenRes.isSuccessful || tokenRes.body() == null) {
                    Log.e(TAG, "❌ Token generation failed: ${tokenRes.errorBody()?.string()}")
                    showToast("Failed to generate meeting token.")
                    return@launch
                }
                val token = tokenRes.body()!!.token
                Log.d(TAG, "🎟 Token generated for $currentUserId")

                // Step 3: Join Daily room
                withContext(Dispatchers.Main) {
                    val finalUrl = "${room.roomUrl}?token=$token"
                    Log.i(TAG, "🔗 Joining Daily room: $finalUrl")
                    webView.loadUrl(finalUrl)
                    tvCallStatus.visibility = View.GONE
                }
            } catch (e: HttpException) {
                Log.e(TAG, "HTTP error: ${e.message()}")
                showToast("Network error: ${e.message()}")
            } catch (e: Exception) {
                Log.e(TAG, "❌ setupDailyRoomAndJoin failed: ${e.message}", e)
                showToast("Error: ${e.message}")
            }
        }
    }

    private fun onCallAccepted() {
        runOnUiThread { Toast.makeText(this, "Call accepted!", Toast.LENGTH_SHORT).show() }
    }

    private fun onCallRejected() {
        runOnUiThread {
            Toast.makeText(this, "Call rejected.", Toast.LENGTH_SHORT).show()
            endCall()
        }
    }

    private fun endCall() {
        Log.i(TAG, "📞 Ending call")
        webView.loadUrl("about:blank")
        finish()
    }

    private fun showToast(message: String) {
        runOnUiThread { Toast.makeText(this, message, Toast.LENGTH_SHORT).show() }
    }
}
