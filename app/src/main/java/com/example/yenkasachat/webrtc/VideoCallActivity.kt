package com.example.yenkasachat.webrtc

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import java.util.Locale
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import kotlinx.coroutines.launch

class VideoCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnEndCall: ImageButton
    private lateinit var tvCallStatus: TextView

    private val webSocketManager = WebSocketManager()

    private var currentUserId: String? = null
    private var targetUserId: String? = null
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
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // Bind XML views
        webView = findViewById(R.id.webview_call)
        btnEndCall = findViewById(R.id.btn_end_call)
        tvCallStatus = findViewById(R.id.tv_call_status)

        webView.settings.javaScriptEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = WebViewClient()

        // Get intent extras
        currentUserId = intent.getStringExtra("CURRENT_USER_ID")
        targetUserId = intent.getStringExtra("TARGET_USER_ID")
        isCaller = intent.getBooleanExtra("IS_CALLER", false)
        isVideoCall = intent.getBooleanExtra("IS_VIDEO_CALL", true)

        if (currentUserId.isNullOrBlank() || targetUserId.isNullOrBlank()) {
            Toast.makeText(this, "Error: User IDs not set.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        // Connect WebSocket
        currentUserId?.let { webSocketManager.connect(it) }

        // Set button listener
        btnEndCall.setOnClickListener { endCall() }

        // Check permissions
        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            setupCall()
        }

        // Listen for incoming call request (only for receiver)
        if (!isCaller) {
            listenForIncomingCall()
        }
    }
    private fun onCallAccepted() {
        runOnUiThread {
            Toast.makeText(this, "Call accepted!", Toast.LENGTH_SHORT).show()
            // Optionally: update UI to show connected state
        }
    }

    private fun onCallRejected() {
        runOnUiThread {
            Toast.makeText(this, "Call rejected by the other user.", Toast.LENGTH_SHORT).show()
            // Optionally: end call
            endCall()
        }
    }

    private fun allPermissionsGranted(): Boolean =
        REQUIRED_PERMISSIONS.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }

    private fun setupCall() {
        tvCallStatus.text = getString(R.string.call_status_initializing)

        // --- 1️⃣ For caller, send call request ---
        if (isCaller) {
            webSocketManager.sendSignalingMessage(
                type = "call_request",
                targetUserId = targetUserId ?: return
            )
            tvCallStatus.text = "Calling..."
        }

        // --- 2️⃣ Join the same room URL ---
        val roomName = if (currentUserId!! < targetUserId!!) {
            "call_${currentUserId}_$targetUserId"
        } else {
            "call_${targetUserId}_$currentUserId"
        }
        val roomUrl = "https://your-daily-domain.daily.co/$roomName"

        // TODO: Generate token from backend if needed
        webView.loadUrl(roomUrl)
        tvCallStatus.text = getString(R.string.call_status_connected)
        tvCallStatus.visibility = View.GONE
    }

    private fun listenForIncomingCall() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { msg ->
                when (msg.type) {
                    SignalingMessageType.CALL_REQUEST -> {
                        if (msg.fromUserId == targetUserId) {
                            showIncomingCallDialog(msg.fromUserId ?: "Unknown")
                        }
                    }
                    SignalingMessageType.CALL_ACCEPT -> {
                        if (msg.fromUserId == targetUserId) {
                            onCallAccepted()
                        }
                    }
                    SignalingMessageType.CALL_REJECT -> {
                        if (msg.fromUserId == targetUserId) {
                            onCallRejected()
                        }
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
                    setupCall()
                    webSocketManager.sendSignalingMessage("call_accept", callerId)
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

    private fun endCall() {
        Log.i(TAG, "📞 Ending call")
        webView.loadUrl("about:blank")
        finish()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE && allPermissionsGranted()) {
            setupCall()
        } else {
            Toast.makeText(this, "Camera & Microphone permissions are required.", Toast.LENGTH_LONG).show()
            finish()
        }
    }
}
