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

    // Callbacks for the Activity to use
    var onRemoteStream: ((MediaStream) -> Unit)? = null
    var onIceCandidate: ((IceCandidate) -> Unit)? = null
    var onConnectionStateChange: ((PeerConnection.IceConnectionState) -> Unit)? = null


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
            .setOptions(PeerConnectionFactory.Options())
        peerConnectionFactory = factoryBuilder.createPeerConnectionFactory()
    }

    fun startLocalMedia(surfaceViewRenderer: SurfaceViewRenderer) {
        val audioSource = peerConnectionFactory?.createAudioSource(MediaConstraints())
        localAudioTrack = peerConnectionFactory?.createAudioTrack("ARDAMSa0", audioSource)

        videoCapturer = createCameraCapturer()
        val videoSource = peerConnectionFactory?.createVideoSource(videoCapturer?.isScreencast ?: false)
        videoCapturer?.initialize(SurfaceTextureHelper.create("VideoCapturerThread", eglBaseContext), context, videoSource?.capturerObserver)
        videoCapturer?.startCapture(1280, 720, 30)

        localVideoTrack = peerConnectionFactory?.createVideoTrack("ARDAMSv0", videoSource)
        localVideoTrack?.addSink(surfaceViewRenderer)
        surfaceViewRenderer.setMirror(true)
    }

    fun setupPeerConnection(iceServers: List<PeerConnection.IceServer>) {
        val rtcConfig = PeerConnection.RTCConfiguration(iceServers)
        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, object : PeerConnection.Observer {
            override fun onSignalingChange(newState: PeerConnection.SignalingState?) {
                Log.d("WebRTCClient", "SignalingState: $newState")
            }

            override fun onIceConnectionChange(newState: PeerConnection.IceConnectionState?) {
                Log.d("WebRTCClient", "IceConnectionState: $newState")
                newState?.let { onConnectionStateChange?.invoke(it) }
            }

            override fun onIceConnectionReceivingChange(p0: Boolean) {}

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
                    webSocketManager.sendSignalingMessage(
                        type = SignalingMessageType.CANDIDATE.name,
                        candidateInfo = candidateInfo,
                        targetUserId = targetUserId
                    )
                    onIceCandidate?.invoke(it)
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
            }

            override fun onRenegotiationNeeded() {
                Log.d("WebRTCClient", "onRenegotiationNeeded")
            }

            override fun onAddTrack(receiver: RtpReceiver?, mediaStreams: Array<out MediaStream>?) {}
        })

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
                    Log.d("WebRTCClient", "Offer created")
                    peerConnection?.setLocalDescription(this, it)
                    webSocketManager.sendSignalingMessage(
                        type = SignalingMessageType.OFFER.name,
                        sdp = it.description,
                        targetUserId = targetUserId
                    )
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
                    Log.d("WebRTCClient", "Answer created")
                    peerConnection?.setLocalDescription(this, it)
                    webSocketManager.sendSignalingMessage(
                        type = SignalingMessageType.ANSWER.name,
                        sdp = it.description,
                        targetUserId = targetUserId
                    )
                }
            }
            override fun onCreateFailure(error: String?) { Log.e("WebRTCClient", "Answer creation failed: $error") }
            override fun onSetSuccess() { Log.d("WebRTCClient", "LocalDescription (answer) set successfully") }
            override fun onSetFailure(error: String?) { Log.e("WebRTCClient", "setLocalDescription (answer) failed: $error") }
        }, sdpConstraints)
    }

    fun handleRemoteOffer(sdpDescription: String) {
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
        Log.d("WebRTCClient", "Closing PeerConnection.")
        videoCapturer?.stopCapture()
        videoCapturer?.dispose()
        videoCapturer = null

        localVideoTrack?.dispose()
        localAudioTrack?.dispose()
        localVideoTrack = null
        localAudioTrack = null

        peerConnection?.close()
        peerConnection = null

        peerConnectionFactory?.dispose()
        peerConnectionFactory = null
    }

    private fun createCameraCapturer(): CameraVideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        for (deviceName in enumerator.deviceNames) {
            if (enumerator.isFrontFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        for (deviceName in enumerator.deviceNames) {
            if (!enumerator.isFrontFacing(deviceName)) {
                return enumerator.createCapturer(deviceName, null)
            }
        }
        return null
    }

    fun toggleAudio(isMuted: Boolean) {
        localAudioTrack?.setEnabled(!isMuted)
    }

    fun toggleVideo(isVideoDisabled: Boolean) {
        localVideoTrack?.setEnabled(!isVideoDisabled)
        if (isVideoDisabled) {
            videoCapturer?.stopCapture()
        } else {
            videoCapturer?.startCapture(1280, 720, 30)
        }
    }
}
