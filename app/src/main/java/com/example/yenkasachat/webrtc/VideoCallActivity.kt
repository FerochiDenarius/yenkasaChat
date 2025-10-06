package com.example.yenkasachat.webrtc

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import kotlinx.coroutines.launch
import org.webrtc.EglBase
import org.webrtc.PeerConnection
import org.webrtc.SurfaceViewRenderer

class VideoCallActivity : AppCompatActivity() {

    private lateinit var localVideoView: SurfaceViewRenderer
    private lateinit var remoteVideoView: SurfaceViewRenderer
    private lateinit var btnEndCall: ImageButton
    private lateinit var btnToggleMic: ImageButton
    private lateinit var btnToggleCamera: ImageButton
    private lateinit var tvCallStatus: TextView

    private lateinit var webSocketManager: WebSocketManager
    private var webRTCClient: WebRTCClient? = null
    private var eglBase: EglBase? = null

    private var targetUserId: String? = null
    private lateinit var currentUserId: String // TODO: This needs to be set from your app's user management
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
        currentUserId = "YOUR_CURRENT_USER_ID" 

        targetUserId = intent.getStringExtra("TARGET_USER_ID")
        val isCaller = intent.getBooleanExtra("IS_CALLER", false)

        if (targetUserId == null) {
            Log.e(TAG, "Target User ID is missing!")
            finish()
            return
        }

        if (currentUserId == "YOUR_CURRENT_USER_ID" || currentUserId.isBlank()) {
            Log.e(TAG, "Current User ID is not set!")
            Toast.makeText(this, "Error: Your user ID is not configured.", Toast.LENGTH_LONG).show()
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

        btnEndCall.setOnClickListener { endCall(notifyPeer = true) }

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
        val eglContext = eglBase?.eglBaseContext ?: return
        
        localVideoView.init(eglContext, null)
        remoteVideoView.init(eglContext, null)
        localVideoView.setZOrderMediaOverlay(true)

        webSocketManager = WebSocketManager()
        webSocketManager.connect(currentUserId)

        val iceServers = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer()
        )

        val currentTargetUserId = targetUserId ?: return

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
                // Example of sending data after connection
                webRTCClient?.sendData("Hello from the other side!")
            }
        }

        webRTCClient?.onDataChannelMessage = { message ->
            runOnUiThread {
                Log.i(TAG, "DataChannel Message: $message")
                Toast.makeText(this, "Received: $message", Toast.LENGTH_SHORT).show()
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
                Log.d(TAG, "Signaling: Type=${message.type}, From=${message.fromUserId}")

                if (message.fromUserId != null && message.fromUserId != targetUserId &&
                    message.type != SignalingMessageType.ERROR && message.type != SignalingMessageType.CONNECTION_ACK) {
                    return@collect
                }

                when (message.type) {
                    SignalingMessageType.OFFER -> {
                        message.sdp?.let { webRTCClient?.handleRemoteOffer(it) }
                    }
                    SignalingMessageType.ANSWER -> {
                        message.sdp?.let { webRTCClient?.handleRemoteAnswer(it) }
                    }
                    SignalingMessageType.CANDIDATE -> {
                        message.candidate?.let { 
                            webRTCClient?.addIceCandidate(it.sdp, it.sdpMid, it.sdpMLineIndex)
                        }
                    }
                    SignalingMessageType.CALL_ENDED -> {
                        runOnUiThread { endCall(notifyPeer = false) }
                    }
                    SignalingMessageType.USER_BUSY -> {
                        runOnUiThread { endCall(notifyPeer = false) }
                    }
                    SignalingMessageType.ERROR -> {
                        tvCallStatus.text = getString(R.string.call_status_error, message.error)
                    }
                    else -> {}
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

    private fun endCall(notifyPeer: Boolean) {
        tvCallStatus.text = getString(R.string.call_status_ended)

        if (notifyPeer && targetUserId != null) {
            webSocketManager.sendSignalingMessage(
                type = SignalingMessageType.CALL_ENDED.name,
                targetUserId = targetUserId!!
            )
        }

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
                initializeCallLogic(intent.getBooleanExtra("IS_CALLER", false))
            } else {
                Toast.makeText(this, "Camera & Microphone permissions are required.", Toast.LENGTH_LONG).show()
                finish()
            }
        }
    }

    override fun onDestroy() {
        endCall(notifyPeer = false)
        super.onDestroy()
    }
}
