package com.example.yenkasachat.webrtc

import android.content.Context
import android.util.Log
import org.webrtc.*

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
    private var dataChannel: DataChannel? = null

    var onRemoteStream: ((MediaStream) -> Unit)? = null
    var onIceCandidate: ((IceCandidate) -> Unit)? = null // Callback to send candidate via WebSocket
    var onDataChannelMessage: ((String) -> Unit)? = null

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
        }
        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {
                Log.d("WebRTCClient", "SignalingState: $newState")
            }

            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
                Log.d("WebRTCClient", "IceConnectionState: $newState")
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {
                Log.d("WebRTCClient", "onIceConnectionReceivingChange: $receiving")
            }

            override fun onIceGatheringChange(newState: PeerConnection.IceGatheringState?) {
                Log.d("WebRTCClient", "IceGatheringState: $newState")
            }

            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    Log.d("WebRTCClient", "onIceCandidate: $it")
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

            override fun onDataChannel(dc: DataChannel?) {
                Log.d("WebRTCClient", "onDataChannel: ${dc?.label()}")
                dc?.registerObserver(object : DataChannel.Observer {
                    override fun onBufferedAmountChange(previousAmount: Long) {}
                    override fun onStateChange() {}
                    override fun onMessage(buffer: DataChannel.Buffer) {
                        val data = buffer.data
                        val bytes = ByteArray(data.remaining())
                        data.get(bytes)
                        val message = String(bytes)
                        Log.d("WebRTCClient", "DataChannel message received: $message")
                        onDataChannelMessage?.invoke(message)
                    }
                })
            }

            override fun onRenegotiationNeeded() {
                Log.d("WebRTCClient", "onRenegotiationNeeded")
            }

            override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {}
        })

        // Add local tracks to the connection
        localAudioTrack?.let { peerConnection?.addTrack(it) }
        localVideoTrack?.let { peerConnection?.addTrack(it) }

        // Create data channel
        val dataChannelInit = DataChannel.Init()
        dataChannel = peerConnection?.createDataChannel("chat_channel", dataChannelInit)
    }

    fun sendData(message: String) {
        dataChannel?.let {
            if (it.state() == DataChannel.State.OPEN) {
                val buffer = DataChannel.Buffer(java.nio.ByteBuffer.wrap(message.toByteArray()), false)
                it.send(buffer)
            } else {
                Log.w("WebRTCClient", "DataChannel is not open. Current state: ${it.state()}")
            }
        }
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
                    peerConnection?.setLocalDescription(this, it) 
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
        dataChannel?.close()
        dataChannel = null

        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null

        peerConnection?.close()
        peerConnection = null

        peerConnectionFactory?.dispose()
        peerConnectionFactory = null
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

    fun toggleAudio(isMuted: Boolean) {
        localAudioTrack?.setEnabled(!isMuted)
    }

    fun toggleVideo(isVideoDisabled: Boolean) {
        localVideoTrack?.setEnabled(!isVideoDisabled)
        if (isVideoDisabled) {
            videoCapturer?.stopCapture()
        } else {
            // Adjust resolution and FPS as needed
            videoCapturer?.startCapture(1280, 720, 30)
        }
    }
}
