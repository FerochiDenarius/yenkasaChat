package com.example.yenkasachat.webrtc

// -----------------------------
// Signaling message types enum
// -----------------------------
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
    USER_BUSY,
    CALL_REQUEST,   // ✅ Added for 1-on-1 call request
    CALL_ACCEPT,    // ✅ Added for call acceptance
    CALL_REJECT     // ✅ Added for call rejection
}

// -----------------------------
// Signaling message data class
// -----------------------------
data class SignalingMessage(
    val type: SignalingMessageType,
    val sdp: String? = null,
    val candidate: CandidateData? = null,
    val fromUserId: String? = null,
    val error: String? = null
)

// -----------------------------
// Candidate data class for ICE
// -----------------------------
data class CandidateData(
    val sdp: String,
    val sdpMid: String,
    val sdpMLineIndex: Int
)
