package com.example.yenkasachat.webrtc
import androidx.appcompat.app.AppCompatActivity
import android.os.Bundle
import android.util.Log
import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.ui.input.key.type
import androidx.compose.ui.layout.layout
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.webrtc.* // Import all WebRTC classes
import org.json.JSONObject // If you use JSONObject for data messaging

class VideoCallActivity : AppCompatActivity() {

    private lateinit var localVideoView: SurfaceViewRenderer
    private lateinit var remoteVideoView: SurfaceViewRenderer
    private lateinit var btnEndCall: androidx.compose.material3.Button

    private lateinit var webSocketManager: WebSocketManager
    private var webRTCClient: WebRTCClient? = null
    private var eglBase: EglBase? = null

    private var targetUserId: String? = null // The user you are calling/is calling you
    private var currentUserId: String = "YOUR_CURRENT_USER_ID" // Get this from TokenManager or similar

    companion object {
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call) // Your layout file

        targetUserId = intent.getStringExtra("TARGET_USER_ID")
        val isCaller = intent.getBooleanExtra("IS_CALLER", false)

        if (targetUserId == null) {
            Log.e("VideoCallActivity", "Target User ID is missing!")
            finish()
            return
        }

        localVideoView = findViewById(R.id.local_video_view)
        remoteVideoView = findViewById(R.id.remote_video_view)
        btnEndCall = findViewById(R.id.btn_end_call)

        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            initializeCall()
            if (isCaller) {
                webRTCClient?.createOffer()
            }
        }

        btnEndCall.setOnClickListener {
            endCall()
        }
    }

    private fun initializeCall() {
        eglBase = EglBase.create()
        localVideoView.init(eglBase!!.eglBaseContext, null)
        remoteVideoView.init(eglBase!!.eglBaseContext, null)
        localVideoView.setZOrderMediaOverlay(true) // Display local view on top

        webSocketManager = WebSocketManager() // Consider making this a singleton or injecting
        webSocketManager.connect(currentUserId)

        // List of STUN/TURN servers
        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
            // Add TURN servers if you have them:
            // PeerConnection.IceServer.builder("turn:your.turn.server.com:port")
            //     .setUsername("user")
            //     .setPassword("pass")
            //     .createIceServer()
        )

        webRTCClient = WebRTCClient(applicationContext, eglBase!!.eglBaseContext, webSocketManager, targetUserId!!)
        webRTCClient?.startLocalMedia(localVideoView)
        webRTCClient?.setupPeerConnection(iceServers)

        webRTCClient?.onRemoteStream = { mediaStream ->
            runOnUiThread {
                Log.i("VideoCallActivity", "Remote stream received, displaying.")
                // Assuming the first video track from the remote stream
                mediaStream.videoTracks.firstOrNull()?.addSink(remoteVideoView)
                // You might also handle audio tracks separately if needed
            }
        }

        observeSignalingMessages()
    }

    private fun observeSignalingMessages() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { message ->
                Log.d("VideoCallActivity", "Received signaling message: ${message.type}")
                when (message.type) {
                    "offer" -> {
                        message.sdp?.let {
                            webRTCClient?.handleRemoteOffer(it)
                        }
                    }
                    "answer" -> {
                        message.sdp?.let {
                            webRTCClient?.handleRemoteAnswer(it)
                        }
                    }
                    "candidate" -> {
                        message.candidate?.let { // Assuming 'candidate' is a parsed object
                            // You need to parse candidate from JSON to individual fields
                            // This part depends on how you structure CandidateData in WebSocketManager
                            // For now, let's assume it's already parsed into sdp, sdpMid, sdpMLineIndex
                            // webRTCClient?.addIceCandidate(it.sdp, it.sdpMid, it.sdpMLineIndex)
                        }
                    }
                    // Handle other signaling messages like "user_busy", "call_ended_by_peer"
                }
            }
        }
        // Observe general messages for custom data
        lifecycleScope.launch {
            webSocketManager.messages.collect { rawMessage ->
                // Try to parse as JSON if you expect custom data messages
                try {
                    val jsonData = JSONObject(rawMessage)
                    if (jsonData.optString("type") == "custom_chat_message") {
                        val chatText = jsonData.optJSONObject("payload")?.optString("text")
                        Log.i("VideoCallActivity", "Received custom data (chat): $chatText")
                        // Update UI with chat message
                    }
                } catch (e: Exception) {
                    Log.w("VideoCallActivity", "Received non-JSON message or parse error: $rawMessage")
                }
            }
        }
    }

    private fun endCall() {
        Log.i("VideoCallActivity", "Ending call.")
        webRTCClient?.close()
        webRTCClient = null
        localVideoView.release()
        remoteVideoView.release()
        webSocketManager.disconnect()
        finish() // Close the activity
    }

    private fun allPermissionsGranted() = REQUIRED_PERMISSIONS.all {
        ContextCompat.checkSelfPermission(baseContext, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (allPermissionsGranted()) {
                initializeCall()
                if (intent.getBooleanExtra("IS_CALLER", false)) { // If permissions granted now, and was caller
                    webRTCClient?.createOffer()
                }
            } else {
                Log.e("VideoCallActivity", "Permissions not granted by the user.")
                // Handle permission denial (e.g., show a message and finish)
                finish()
            }
        }
    }

    override fun onDestroy() {
        endCall() // Ensure resources are released
        super.onDestroy()
    }

    // --- Example for sending custom data ---
    fun sendChatMessageInCall(text: String) {
        val dataPayload = JSONObject().apply {
            put("text", text)
        }
        targetUserId?.let {
            webSocketManager.sendData(dataPayload, it)
        }
    }
}
