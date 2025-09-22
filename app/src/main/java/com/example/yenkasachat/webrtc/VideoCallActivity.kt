package com.example.yenkasachat.webrtc

// Standard Android Imports
import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.ImageButton // For ImageButton from XML
import android.widget.TextView    // For TextView from XML
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope

// Your project's R class - REPLACE 'com.example.yenkasachat' with your actual app package name if different
import com.example.yenkasachat.R

// Coroutines
import kotlinx.coroutines.launch

// WebRTC and JSON
import org.json.JSONObject
import org.webrtc.EglBase
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.SurfaceViewRenderer
// Note: If WebRTCClient is in the same package, you don't need to import it explicitly.
// If WebSocketManager is in the same package, you don't need to import it explicitly.
// If SignalingMessageType is in the same package, you don't need to import it explicitly.


class VideoCallActivity : AppCompatActivity() {

    // UI Elements from XML
    private lateinit var localVideoView: SurfaceViewRenderer
    private lateinit var remoteVideoView: SurfaceViewRenderer
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnToggleMic: ImageButton
    private lateinit var btnToggleCamera: ImageButton
    private lateinit var tvCallStatus: TextView // Optional status text

    // WebRTC & WebSocket components
    private lateinit var webSocketManager: WebSocketManager
    private var webRTCClient: WebRTCClient? = null
    private var eglBase: EglBase? = null

    // Call State
    private var targetUserId: String? = null
    private lateinit var currentUserId: String // Needs to be initialized properly
    private var isMicMuted = false
    private var isLocalVideoDisabled = false

    companion object {
        private const val TAG = "VideoCallActivity"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Ensure this line is present and R.layout.activity_video_call is resolved
        setContentView(R.layout.activity_video_call)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // TODO: Replace this with your actual method of getting the current user's ID
        currentUserId = "YOUR_CURRENT_USER_ID" // e.g., TokenManager.getUserId() or similar

        targetUserId = intent.getStringExtra("TARGET_USER_ID")
        val isCaller = intent.getBooleanExtra("IS_CALLER", false)

        if (targetUserId == null) {
            Log.e(TAG, "Target User ID is missing!")
            // TODO: Show an error message to the user before finishing
            finish()
            return
        }

        if (currentUserId == "YOUR_CURRENT_USER_ID" || currentUserId.isBlank()) {
            Log.e(TAG, "Current User ID is not set!")
            // TODO: Show an error message to the user before finishing
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
        tvCallStatus = findViewById(R.id.tv_call_status) // Initialize if you use it

        btnEndCall.setOnClickListener {
            endCall()
        }

        btnToggleMic.setOnClickListener {
            isMicMuted = !isMicMuted
            webRTCClient?.toggleAudio(isMicMuted) // You'll need to add toggleAudio(isMuted: Boolean) to WebRTCClient
            updateMicButtonUI()
        }

        btnToggleCamera.setOnClickListener {
            isLocalVideoDisabled = !isLocalVideoDisabled
            webRTCClient?.toggleVideo(isLocalVideoDisabled) // You'll need to add toggleVideo(isDisabled: Boolean) to WebRTCClient
            updateCameraButtonUI()
        }
        // Initialize UI states
        updateMicButtonUI()
        updateCameraButtonUI()
    }

    private fun initializeCallLogic(isCaller: Boolean) {
        // tvCallStatus.text = "Initializing..." // Example status update
        // tvCallStatus.visibility = View.VISIBLE

        eglBase = EglBase.create()

        // Initialize SurfaceViewRenderers
        // Ensure EGL context is not null before passing
        eglBase?.eglBaseContext?.let { eglContext ->
            localVideoView.init(eglContext, null)
            remoteVideoView.init(eglContext, null)
        } ?: run {
            Log.e(TAG, "EGL Base Context is null. Cannot initialize SurfaceViewRenderers.")
            // TODO: Handle this error, perhaps show message and finish
            endCall()
            return
        }
        localVideoView.setZOrderMediaOverlay(true) // Display local view on top

        webSocketManager = WebSocketManager() // Consider making this a singleton or injecting via Hilt/Koin
        webSocketManager.connect(currentUserId)

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
            // Add TURN servers here if needed
        )

        // Ensure eglBase and targetUserId are not null
        val currentEglBase = eglBase ?: run { Log.e(TAG, "EglBase is null before creating WebRTCClient"); endCall(); return }
        val currentTargetUserId = targetUserId ?: run { Log.e(TAG, "TargetUserID is null before creating WebRTCClient"); endCall(); return }

        webRTCClient = WebRTCClient(
            applicationContext,
            currentEglBase.eglBaseContext, // Safe now due to check above
            webSocketManager,
            currentTargetUserId // Safe now due to check above
        )

        webRTCClient?.onRemoteStream = { mediaStream ->
            runOnUiThread {
                Log.i(TAG, "Remote stream received.")
                // tvCallStatus.text = "Connected" // Example
                mediaStream.videoTracks.firstOrNull()?.addSink(remoteVideoView)
                // You might also handle audio tracks: mediaStream.audioTracks.firstOrNull()?.setEnabled(true)
            }
        }

        webRTCClient?.onConnectionStateChange = { newState ->
            runOnUiThread {
                Log.i(TAG, "PeerConnection State: $newState")
                // tvCallStatus.text = "State: ${newState.name}" // Example
                // Handle states like FAILED, DISCONNECTED to potentially end the call or show error
                if (newState == PeerConnection.IceConnectionState.FAILED ||
                    newState == PeerConnection.IceConnectionState.DISCONNECTED ||
                    newState == PeerConnection.IceConnectionState.CLOSED) {
                    // Consider a more graceful handling or retry mechanism depending on state
                    // endCall()
                }
            }
        }

        // Start local media only after WebRTCClient is initialized
        webRTCClient?.startLocalMedia(localVideoView)
        webRTCClient?.setupPeerConnection(iceServers)

        observeSignalingMessages()

        if (isCaller) {
            // tvCallStatus.text = "Calling $targetUserId..." // Example
            webRTCClient?.createOffer()
        } else {
            // tvCallStatus.text = "Incoming call..." // Or set when offer is received
        }
    }

    private fun observeSignalingMessages() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { message -> // message is SignalingMessage
                Log.d(TAG, "Signaling: Type=${message.type}, SDP=${message.sdp != null}, Cand=${message.candidate != null}, From=${message.fromUserId}, Error=${message.error}")

                // Optional: Validate if the message is from the expected targetUser or a general server message
                if (message.fromUserId != null && message.fromUserId != targetUserId &&
                    message.type != SignalingMessageType.ERROR && message.type != SignalingMessageType.CONNECTION_ACK) { // Allow general errors/acks
                    Log.w(TAG, "Ignoring signaling message from unexpected user: ${message.fromUserId}. Expected: $targetUserId")
                    return@collect
                }

                when (message.type) {
                    SignalingMessageType.OFFER -> {
                        Log.i(TAG, "Received OFFER from ${message.fromUserId}")
                        // tvCallStatus.text = "Incoming call from ${message.fromUserId}" // Example
                        message.sdp?.let { webRTCClient?.handleRemoteOffer(it) }
                            ?: Log.e(TAG, "Offer SDP is null")
                    }
                    SignalingMessageType.ANSWER -> {
                        Log.i(TAG, "Received ANSWER from ${message.fromUserId}")
                        // tvCallStatus.text = "Call answered by ${message.fromUserId}" // Example
                        message.sdp?.let { webRTCClient?.handleRemoteAnswer(it) }
                            ?: Log.e(TAG, "Answer SDP is null")
                    }
                    SignalingMessageType.CANDIDATE -> {
                        message.candidate?.let { candidateData ->
                            Log.i(TAG, "Received CANDIDATE from ${message.fromUserId}")
                            webRTCClient?.addIceCandidate(
                                candidateData.sdp,
                                candidateData.sdpMid,
                                candidateData.sdpMLineIndex
                            )
                        } ?: Log.e(TAG, "Candidate data is null for CANDIDATE message")
                    }
                    SignalingMessageType.CALL_ENDED -> {
                        Log.i(TAG, "Call ended by peer: ${message.fromUserId}")
                        // tvCallStatus.text = "Call ended by peer" // Example
                        runOnUiThread { endCall() }
                    }
                    SignalingMessageType.USER_BUSY -> {
                        Log.i(TAG, "Peer is busy: ${message.fromUserId}")
                        // tvCallStatus.text = "User is busy" // Example
                        runOnUiThread { endCall() } // Or show a specific message and then end
                    }
                    SignalingMessageType.ERROR -> {
                        Log.e(TAG, "Received signaling error: ${message.error} from ${message.fromUserId ?: "server"}")
                        // tvCallStatus.text = "Error: ${message.error}" // Example
                        // Optionally end call depending on error
                        // runOnUiThread { endCall() }
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
                // This is for custom non-signaling data, e.g., in-call text chat via WebSocket
                try {
                    val jsonData = JSONObject(rawMessage)
                    if (jsonData.optString("type") == "custom_chat_message") {
                        val chatText = jsonData.optJSONObject("payload")?.optString("text")
                        Log.i(TAG, "Received custom data (chat): $chatText")
                        // TODO: Update UI with chat message
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Received non-JSON general message or parse error: $rawMessage", e)
                }
            }
        }
    }

    private fun updateMicButtonUI() {
        if (isMicMuted) {
            btnToggleMic.setImageResource(R.drawable.ic_mic_off) // Ensure ic_mic_off.xml exists
        } else {
            btnToggleMic.setImageResource(R.drawable.ic_mic_on)
        }
    }

    private fun updateCameraButtonUI() {
        if (isLocalVideoDisabled) {
            btnToggleCamera.setImageResource(R.drawable.ic_videocam_off) // Ensure ic_videocam_off.xml exists
            localVideoView.clearImage() // Optional: clear local view when camera is off
            // webRTCClient?.stopLocalVideo() // More robust: actually stop capturing
        } else {
            btnToggleCamera.setImageResource(R.drawable.ic_videocam_on)
            // webRTCClient?.startLocalVideo(localVideoView) // More robust: restart capturing
        }
    }


    private fun endCall() {
        Log.i(TAG, "Ending call.")
        // tvCallStatus.text = "Call Ended" // Example
        // tvCallStatus.visibility = View.VISIBLE

        webRTCClient?.close() // This should release WebRTC resources including camera/mic
        webRTCClient = null

        localVideoView.release()
        remoteVideoView.release()
        eglBase?.release() // Release EGL a
