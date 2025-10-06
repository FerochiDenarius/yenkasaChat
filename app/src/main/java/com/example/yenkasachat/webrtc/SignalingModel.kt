package com.example.yenkasachat.webrtc

enum class SignalingMessageType {
    OFFER,
    ANSWER,
    CANDIDATE,
    ICE_CANDIDATE,
    USER_JOINED,
    USER_LEFT,
    ERROR,
    UNKNOWN,
    CONNECTION_ACK,
    CALL_ENDED,
    USER_BUSY
}

data class SignalingMessage(
    val type: SignalingMessageType,
    val sdp: String? = null,
    val candidate: CandidateData? = null,
    val fromUserId: String? = null,
    val error: String? = null
)

data class CandidateData(
    val sdp: String,
    val sdpMid: String,
    val sdpMLineIndex: Int
)
