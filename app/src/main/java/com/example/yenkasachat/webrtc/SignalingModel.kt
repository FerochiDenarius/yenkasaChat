// In a new file, e.g., webrtc/SignalingModel.kt
package com.example.yenkasachat.webrtc // Or your appropriate model package

// Represents a parsed signaling message received from the WebSocket
data class SignalingMessage(
    val type: SignalingMessageType, // Use an enum for type safety
    val sdp: String? = null,
    val candidate: CandidateData? = null,
    val fromUserId: String? = null, // Who sent this message (populated by server or parsed)
    val error: String? = null // For error messages from server
    // Add other fields your server might send, e.g., roomId
)

data class CandidateData(
    val sdp: String,
    val sdpMid: String,
    val sdpMLineIndex: Int
)

// Enum for signaling message types for better type safety and clarity
enum class SignalingMessageType {
    OFFER,
    ANSWER,
    CANDIDATE,
    USER_JOINED, // Example: if server notifies about other users
    USER_LEFT,   // Example
    CALL_ENDED,  // Example: Peer explicitly ended the call
    USER_BUSY,   // Example
    CONNECTION_ACK, // Example: Server acknowledges connection
    ERROR,         // Example: For server-side errors related to signaling
    UNKNOWN        // Fallback for types not explicitly handled
}
   