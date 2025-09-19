package com.example.yenkasachat.webrtc
import android.content.Context
import android.media.AudioTrack
import android.util.Log
import androidx.compose.foundation.layout.add
import org.webrtc.*
import org.json.JSONObject

class WebRTCClient(
    private val context: Context,
    private val eglBaseContext: EglBase.Context,
    private val webSocketManager: WebSocketManager, // To send signaling messages
    private val targetUserId: String // The user you are calling
) {
    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null

    var onRemoteStream: ((MediaStream) -> Unit)? = null
    var onIceCandidate: ((IceCandidate) -> Unit)? = null // Callback to send candidate via WebSocket


    init {
        initPeerConnectionFactory()
    }

    private fun initPeerConnectionFactory() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        val factoryBuilder = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBaseContext))
            .setOptions(PeerConnectionFactory.Options().apply {
                // networkIgnoreMask = 0 // Optional: configure network interface usage
            })
        peerConnectionFactory = factoryBuilder.createPeerConnectionFactory()
    }

    fun startLocalMedia(surfaceViewRenderer: SurfaceViewRenderer) {
        // Audio
        val audioSource = peerConnectionFactory?.createAudioSource(MediaConstraints())
        localAudioTrack = peerConnectionFactory?.createAudioTrack("ARDAMSa0", audioSource)

        // Video
        videoCapturer = createCameraCapturer()
        val videoSource = peerConnectionFactory?.createVideoSource(videoCapturer?.isScreencast ?: false)
        videoCapturer?.initialize(SurfaceTextureHelper.create("VideoCapturerThread", eglBaseContext), context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30) // Adjust resolution/fps

        localVideoTrack = peerConnectionFactory?.createVideoTrack("ARDAMSv0", videoSource)
        localVideoTrack?.addSink(surfaceViewRenderer) // Display local video
        surfaceViewRenderer.setMirror(true) // For front camera
    }

    fun setupPeerConnection(iceServers: List<PeerConnection.IceServer>) {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers).apply {
            // Additional RTCConfiguration options if needed
            // e.g., iceTransportPolicy = PeerConnection.IceTransportPolicy.RELAY (for TURN only)
        }
        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {
                Log.d("WebRTCClient", "SignalingState: $newState")
            }

            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
                Log.d("WebRTCClient", "IceConnectionState: $newState")
                // Handle connected, disconnected states
            }

            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {
                Log.d("WebRTCClient", "IceGatheringState: $newState")
            }

            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    Log.d("WebRTCClient", "onIceCandidate: $it")
                    // Send this candidate to the other peer via WebSocket
                    val candidateInfo = mapOf(
                        "candidate" to it.sdp,
                        "sdpMid" to it.sdpMid,
                        "sdpMLineIndex" to it.sdpMLineIndex
                    )
                    webSocketManager.sendSignalingMessage("candidate", candidateInfo = candidateInfo, targetUserId = targetUserId)
                    onIceCandidate?.invoke(it) // For local handling if needed
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}

            override fun onAddStream(stream: MediaStream?) {
                stream?.let {
                    Log.d("WebRTCClient", "Remote stream added")
                    onRemoteStream?.invoke(it)
                }
            }

            override fun onRemoveStream(stream: MediaStream?) {
                Log.d("WebRTCClient", "Remote stream removed")
            }

            override fun onDataChannel(dataChannel: DataChannel?) {
                Log.d("WebRTCClient", "onDataChannel: ${dataChannel?.label()}")
                // Handle incoming data channel if the other peer initiates it
            }

            override fun onRenegotiationNeeded() {
                Log.d("WebRTCClient", "onRenegotiationNeeded")
                // Could potentially create a new offer here if needed
            }

            override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {}
        })

        // Add local tracks to the connection
        localAudioTrack?.let { peerConnection?.addTrack(it) }
        localVideoTrack?.let { peerConnection?.addTrack(it) }
    }


    fun createOffer() {
        val sdpConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    Log.d("WebRTCClient", "Offer created: ${it.description}")
                    peerConnection?.setLocalDescription(this, it) // 'this' refers to SdpObserver for setLocalDescription
                    // Send this offer (it.description) to the other peer via WebSocket
                    webSocketManager.sendSignalingMessage("offer", sdp = it.description, targetUserId = targetUserId)
                }
            }
            override fun onCreateFailure(error: String?) { Log.e("WebRTCClient", "Offer creation failed: $error") }
            override fun onSetSuccess() { Log.d("WebRTCClient", "LocalDescription (offer) set successfully") }
            override fun onSetFailure(error: String?) { Log.e("WebRTCClient", "setLocalDescription (offer) failed: $error") }
        }, sdpConstraints)
    }

    fun createAnswer() {
        val sdpConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp?.let {
                    Log.d("WebRTCClient", "Answer created: ${it.description}")
                    peerConnection?.setLocalDescription(this, it)
                    // Send this answer (it.description) to the other peer via WebSocket
                    webSocketManager.sendSignalingMessage("answer", sdp = it.description, targetUserId = targetUserId)
                }
            }
            override fun onCreateFailure(error: String?) { Log.e("WebRTCClient", "Answer creation failed: $error") }
            override fun onSetSuccess() { Log.d("WebRTCClient", "LocalDescription (answer) set successfully") }
            override fun onSetFailure(error: String?) { Log.e("WebRTCClient", "setLocalDescription (answer) failed: $error") }
        }, sdpConstraints)
    }

    fun handleRemoteOffer(sdpDescription: String) {
        Log.d("WebRTCClient", "Handling remote offer")
        val sdp = SessionDescription(SessionDescription.Type.OFFER, sdpDescription)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() {
                Log.d("WebRTCClient", "RemoteDescription (offer) set successfully")
                createAnswer()
            }
            override fun onSetFailure(error: String?) { Log.e("WebRTCClient", "setRemoteDescription (offer) failed: $error") }
            // No need to implement onCreateSuccess/Failure here
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onCreateFailure(p0: String?) {}
        }, sdp)
    }

    fun handleRemoteAnswer(sdpDescription: String) {
        Log.d("WebRTCClient", "Handling remote answer")
        val sdp = SessionDescription(SessionDescription.Type.ANSWER, sdpDescription)
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onSetSuccess() { Log.d("WebRTCClient", "RemoteDescription (answer) set successfully") }
            override fun onSetFailure(error: String?) { Log.e("WebRTCClient", "setRemoteDescription (answer) failed: $error") }
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onCreateFailure(p0: String?) {}
        }, sdp)
    }

    fun addIceCandidate(sdp: String, sdpMid: String, sdpMLineIndex: Int) {
        val candidate = IceCandidate(sdpMid, sdpMLineIndex, sdp)
        peerConnection?.addIceCandidate(candidate)
    }


    fun close() {
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null

        localVideoTrack?.dispose()
        localAudioTrack?.dispose()

        peerConnection?.close()
        peerConnection = null

        peerConnectionFactory?.dispose()
        peerConnectionFactory = null

        EglBase.terminate() // If you created an EglBase instance
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames

        // Try front camera
        for (deviceName in deviceNames) {
            if (enumerator.isFrontFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        // Try back camera
        for (deviceName in deviceNames) {
            if (enumerator.isBackFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        return null // No camera found
    }
}
