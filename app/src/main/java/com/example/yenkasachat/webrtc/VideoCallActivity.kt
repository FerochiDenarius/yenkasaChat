package com.example.yenkasachat.webrtc

// Standard Android Imports
import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import kotlinx.coroutines.launch
import org.json.JSONObject
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.SurfaceViewRenderer

class VideoCallActivity : AppCompatActivity() {

    // UI Elements from XML
    private lateinit var localVideoView: SurfaceViewRenderer
    private lateinit var remoteVideoView: SurfaceViewRenderer
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnToggleMic: ImageButton
    private lateinit var btnToggleCamera: ImageButton
    private lateinit var tvCallStatus: TextView

    // WebRTC & WebSocket components
    private lateinit var webSocketManager: WebSocketManager
    private var webRTCClient: WebRTCClient? = null
    private var eglBase: EglBase? = null

    // Call State
    private var targetUserId: String? = null
    private lateinit var currentUserId: String
    private var isMicMuted = false
    private var isLocalVideoDisabled = false

    companion object {
        private const val TAG = "VideoCallActivity"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // TODO: Replace this with your actual method of getting the current user's ID
        currentUserId = "YOUR_CURRENT_USER_ID" // e.g., from your app's user management

        targetUserId = intent.getStringExtra("TARGET_USER_ID")
        val isCaller = intent.getBooleanExtra("IS_CALLER", false)

        if (targetUserId == null) {
            Log.e(TAG, "Target User ID is missing!")
            finish()
            return
        }

        if (currentUserId == "YOUR_CURRENT_USER_ID" || currentUserId.isBlank()) {
            Log.e(TAG, "Current User ID is not set!")
            finish()
            return
        }

        initializeUI()

        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            initializeCallLogic(isCaller)
        }
    }

    private fun initializeUI() {
        localVideoView = findViewById(R.id.local_video_view)
        remoteVideoView = findViewById(R.id.remote_video_view)
        btnEndCall = findViewById(R.id.btn_end_call)
        btnToggleMic = findViewById(R.id.btn_toggle_mic)
        btnToggleCamera = findViewById(R.id.btn_toggle_camera)
        tvCallStatus = findViewById(R.id.tv_call_status)

        btnEndCall.setOnClickListener {
            endCall()
        }

        btnToggleMic.setOnClickListener {
            isMicMuted = !isMicMuted
            webRTCClient?.toggleAudio(isMicMuted)
            updateMicButtonUI()
        }

        btnToggleCamera.setOnClickListener {
            isLocalVideoDisabled = !isLocalVideoDisabled
            webRTCClient?.toggleVideo(isLocalVideoDisabled)
            updateCameraButtonUI()
        }
        updateMicButtonUI()
        updateCameraButtonUI()
    }

    private fun initializeCallLogic(isCaller: Boolean) {
        tvCallStatus.visibility = View.VISIBLE
        tvCallStatus.text = getString(R.string.call_status_initializing)

        eglBase = EglBase.create()
        val eglContext = eglBase?.eglBaseContext ?: run {
            Log.e(TAG, "EGL Base Context is null.")
            endCall()
            return
        }
        localVideoView.init(eglContext, null)
        remoteVideoView.init(eglContext, null)
        localVideoView.setZOrderMediaOverlay(true)

        webSocketManager = WebSocketManager()
        webSocketManager.connect(currentUserId)

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )

        val currentTargetUserId = targetUserId ?: run {
            Log.e(TAG, "TargetUserID is null before creating WebRTCClient")
            endCall()
            return
        }

        webRTCClient = WebRTCClient(
            applicationContext,
            eglContext,
            webSocketManager,
            currentTargetUserId
        )

        webRTCClient?.onRemoteStream = { mediaStream ->
            runOnUiThread {
                Log.i(TAG, "Remote stream received.")
                tvCallStatus.text = getString(R.string.call_status_connected)
                mediaStream.videoTracks.firstOrNull()?.addSink(remoteVideoView)
            }
        }

        webRTCClient?.onConnectionStateChange = { newState ->
            runOnUiThread {
                Log.i(TAG, "PeerConnection State: $newState")
                tvCallStatus.text = getString(R.string.call_status_state, newState.name)
                if (newState == PeerConnection.IceConnectionState.FAILED ||
                    newState == PeerConnection.IceConnectionState.DISCONNECTED ||
                    newState == PeerConnection.IceConnectionState.CLOSED) {
                    endCall()
                }
            }
        }

        webRTCClient?.startLocalMedia(localVideoView)
        webRTCClient?.setupPeerConnection(iceServers)

        observeSignalingMessages()

        if (isCaller) {
            tvCallStatus.text = getString(R.string.call_status_calling, targetUserId)
            webRTCClient?.createOffer()
        }
    }

    private fun observeSignalingMessages() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { message ->
                Log.d(TAG, "Signaling: Type=${message.type}, SDP=${message.sdp != null}, Cand=${message.candidate != null}, From=${message.fromUserId}, Error=${message.error}")

                if (message.fromUserId != null && message.fromUserId != targetUserId &&
                    message.type != SignalingMessageType.ERROR && message.type != SignalingMessageType.CONNECTION_ACK) {
                    Log.w(TAG, "Ignoring signaling message from unexpected user: ${message.fromUserId}. Expected: $targetUserId")
                    return@collect
                }

                when (message.type) {
                    SignalingMessageType.OFFER -> {
                        Log.i(TAG, "Received OFFER from ${message.fromUserId}")
                        tvCallStatus.text = getString(R.string.call_status_incoming)
                        message.sdp?.let { webRTCClient?.handleRemoteOffer(it) } ?: Log.e(TAG, "Offer SDP is null")
                    }
                    SignalingMessageType.ANSWER -> {
                        Log.i(TAG, "Received ANSWER from ${message.fromUserId}")
                        tvCallStatus.text = getString(R.string.call_status_answered)
                        message.sdp?.let { webRTCClient?.handleRemoteAnswer(it) } ?: Log.e(TAG, "Answer SDP is null")
                    }
                    SignalingMessageType.CANDIDATE -> {
                        message.candidate?.let { candidateData ->
                            Log.i(TAG, "Received CANDIDATE from ${message.fromUserId}")
                            webRTCClient?.addIceCandidate(candidateData.sdp, candidateData.sdpMid, candidateData.sdpMLineIndex)
                        } ?: Log.e(TAG, "Candidate data is null for CANDIDATE message")
                    }
                    SignalingMessageType.CALL_ENDED -> {
                        Log.i(TAG, "Call ended by peer: ${message.fromUserId}")
                        tvCallStatus.text = getString(R.string.call_status_ended_by_peer)
                        runOnUiThread { endCall() }
                    }
                    SignalingMessageType.USER_BUSY -> {
                        Log.i(TAG, "Peer is busy: ${message.fromUserId}")
                        tvCallStatus.text = getString(R.string.call_status_user_busy)
                        runOnUiThread { endCall() }
                    }
                    SignalingMessageType.ERROR -> {
                        Log.e(TAG, "Received signaling error: ${message.error} from ${message.fromUserId ?: "server"}")
                        tvCallStatus.text = getString(R.string.call_status_error, message.error)
                    }
                    SignalingMessageType.CONNECTION_ACK -> {
                        Log.i(TAG, "WebSocket connection acknowledged by server.")
                    }
                    else -> {
                        Log.w(TAG, "Received unhandled SignalingMessageType: ${message.type}")
                    }
                }
            }
        }

        lifecycleScope.launch {
            webSocketManager.messages.collect { rawMessage ->
                try {
                    val jsonData = JSONObject(rawMessage)
                    if (jsonData.optString("type") == "custom_chat_message") {
                        val chatText = jsonData.optJSONObject("payload")?.optString("text")
                        Log.i(TAG, "Received custom data (chat): $chatText")
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Received non-JSON general message or parse error: $rawMessage", e)
                }
            }
        }
    }

    private fun updateMicButtonUI() {
        if (isMicMuted) {
            btnToggleMic.setImageResource(R.drawable.ic_mic_off)
        } else {
            btnToggleMic.setImageResource(R.drawable.ic_mic_on)
        }
    }

    private fun updateCameraButtonUI() {
        if (isLocalVideoDisabled) {
            btnToggleCamera.setImageResource(R.drawable.ic_videocam_off)
        } else {
            btnToggleCamera.setImageResource(R.drawable.ic_videocam_on)
        }
    }

    private fun endCall() {
        Log.i(TAG, "Ending call.")
        tvCallStatus.text = getString(R.string.call_status_ended)

        webRTCClient?.close()
        webRTCClient = null

        localVideoView.release()
        remoteVideoView.release()
        eglBase?.release()
        eglBase = null

        webSocketManager.disconnect()

        finish()
    }

    private fun allPermissionsGranted(): Boolean {
        return REQUIRED_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (allPermissionsGranted()) {
                val isCaller = intent.getBooleanExtra("IS_CALLER", false)
                initializeCallLogic(isCaller)
            } else {
                Log.e(TAG, "Permissions not granted by the user.")
                finish()
            }
        }
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy called")
        endCall()
        super.onDestroy()
    }
}
