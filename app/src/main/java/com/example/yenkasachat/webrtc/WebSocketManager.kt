package com.example.yenkasachat.webrtc

import android.util.Log
import okhttp3.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import org.json.JSONObject

class WebSocketManager {
    private var webSocket: WebSocket? = null
    private val _messages = MutableSharedFlow<String>() // For raw messages
    val messages: SharedFlow<String> = _messages

    // For structured signaling messages
    private val _signalingMessages = MutableSharedFlow<SignalingMessage>()
    val signalingMessages: SharedFlow<SignalingMessage> = _signalingMessages


    private val client = OkHttpClient.Builder().build()

    // Replace with your Heroku WebSocket URL (e.g., "wss://your-app-name.herokuapp.com")
    private val webSocketUrl = "YOUR_HEROKU_WEBSOCKET_URL"

    fun connect(userId: String) { // Or some other identifier
        if (webSocket != null) {
            Log.w("WebSocketManager", "Already connected or connecting.")
            return
        }
        val request = Request.Builder().url("$webSocketUrl?userId=$userId").build() // Pass user ID if your server needs it
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i("WebSocketManager", "WebSocket Connected")
                // Maybe send a "join" message or user registration here
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("WebSocketManager", "Received: $text")
                // Parse message and emit to the appropriate flow
                try {
                    // Assume messages are JSON strings
                    // You'll need to define a clear message structure with your backend
                    val json = JSONObject(text)
                    val type = json.optString("type")

                    // Example: Parse based on type
                    // This is a simplified example. You'll need more robust parsing.
                    when (type) {
                        "offer", "answer", "candidate" -> {
                            _signalingMessages.tryEmit(parseSignalingMessage(json)) // Implement parseSignalingMessage
                        }
                        "user_joined", "user_left" -> {
                            // Handle these specific notifications
                        }
                        "data_message" -> {
                            val content = json.optString("content")
                            _messages.tryEmit(content) // Or a dedicated data flow
                        }
                        else -> _messages.tryEmit(text) // Fallback for other messages
                    }
                } catch (e: Exception) {
                    Log.e("WebSocketManager", "Error parsing message: $text", e)
                    _messages.tryEmit("Error parsing: $text") // Emit raw on error
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.i("WebSocketManager", "WebSocket Closing: $code / $reason")
                webSocket.close(1000, null)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocketManager", "WebSocket Error: " + t.message, t)
                this@WebSocketManager.webSocket = null // Allow reconnection
            }
        })
    }

    fun sendMessage(message: String) {
        Log.d("WebSocketManager", "Sending: $message")
        webSocket?.send(message)
    }

    fun sendSignalingMessage(type: String, sdp: String? = null, candidateInfo: Map<String, Any>? = null, targetUserId: String) {
        val json = JSONObject().apply {
            put("type", type)
            put("targetUserId", targetUserId) // Tell server who this message is for
            sdp?.let { put("sdp", it) }
            candidateInfo?.let {
                put("candidate", it["candidate"])
                put("sdpMid", it["sdpMid"])
                put("sdpMLineIndex", it["sdpMLineIndex"])
            }
        }
        sendMessage(json.toString())
    }


    fun sendData(data: JSONObject, targetUserId: String) {
        val message = JSONObject().apply {
            put("type", "data_message")
            put("targetUserId", targetUserId)
            put("payload", data)
        }
        sendMessage(message.toString())
    }

    fun disconnect() {
        webSocket?.close(1000, "User disconnected")
        webSocket = null
    }

    // You'll need data classes for your signaling messages
    // e.g., data class SignalingMessage(val type: String, val sdp: String?, val candidate: CandidateData?)
    // And implement parseSignalingMessage based on your JSON structure
    // Inside WebSocketManager.kt

    // ... (other code) ...

    // Add this method to WebSocketManager
    private fun parseSignalingMessage(json: JSONObject): SignalingMessage {
        val typeString = json.optString("type").uppercase() // Convert to uppercase for enum matching
        val sdp = json.optString("sdp", null) // Default to null if not present
        val fromUserId = json.optString("fromUserId", null) // Assuming server adds this
        val errorMessage = json.optString("message", null) // If type is ERROR or has an error message field

        val type = try {
            SignalingMessageType.valueOf(typeString)
        } catch (e: IllegalArgumentException) {
            Log.w("WebSocketManager", "Unknown signaling message type: $typeString")
            SignalingMessageType.UNKNOWN
        }

        var candidateData: CandidateData? = null
        if (type == SignalingMessageType.CANDIDATE) {
            val candidateSdp = json.optString("candidate", null) // Field name from your sendSignalingMessage
            val sdpMid = json.optString("sdpMid", null)
            val sdpMLineIndex = json.optInt("sdpMLineIndex", -1) // Use optInt

            if (candidateSdp != null && sdpMid != null && sdpMLineIndex != -1) {
                candidateData = CandidateData(candidateSdp, sdpMid, sdpMLineIndex)
            } else {
                Log.w("WebSocketManager", "Received candidate message with missing fields: $json")
                // Optionally return an error type or handle appropriately
            }
        }

        return SignalingMessage(
            type = type,
            sdp = sdp,
            candidate = candidateData,
            fromUserId = fromUserId,
            error = if (type == SignalingMessageType.ERROR) errorMessage else null
        )
    }

    // Modify the onMessage to use the refined parsing

    // ... (rest of WebSocketManager) ...

}
