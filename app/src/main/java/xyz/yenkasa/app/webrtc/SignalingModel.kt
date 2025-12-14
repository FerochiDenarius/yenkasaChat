package xyz.yenkasa.app.webrtc

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
    CALL_REQUEST,   // ✅ 1-on-1 call request
    CALL_ACCEPT,    // ✅ Call accepted
    CALL_REJECT ,    // ✅ Call rejected
    CALL_ACCEPT_WITH_ROOM
}

// -----------------------------
// Signaling message data class
// -----------------------------
data class SignalingMessage(
    val type: SignalingMessageType,

    // --- Standard WebRTC fields ---
    val sdp: String? = null,
    val candidate: CandidateData? = null,

    // --- Common meta ---
    val fromUserId: String? = null,
    val error: String? = null,

    // --- ✅ Caller / callee metadata ---
    val callerName: String? = null,      // display name of the caller
    val callerPhoto: String? = null,     // profile image URL of the caller
    val isVideo: Boolean? = null,        // true for video, false for audio
    val roomName: String? = null,        // Daily room name (if provided)
    val roomUrl: String? = null,         // Daily room URL
    val token: String? = null            // Daily meeting token
)

// -----------------------------
// Candidate data class for ICE
// -----------------------------
data class CandidateData(
    val sdp: String,
    val sdpMid: String,
    val sdpMLineIndex: Int
)
