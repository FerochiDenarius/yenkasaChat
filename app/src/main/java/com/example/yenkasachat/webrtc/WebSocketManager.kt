package com.example.yenkasachat.webrtc

import android.util.Log
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.*
import org.json.JSONObject

class WebSocketManager {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder().build()

    // Observable flows for frontend layers (UI or WebRTC handlers)
    private val _messages = MutableSharedFlow<String>()
    val messages: SharedFlow<String> = _messages

    private val _signalingMessages = MutableSharedFlow<SignalingMessage>()
    val signalingMessages: SharedFlow<SignalingMessage> = _signalingMessages

    private val webSocketUrl = "wss://yenkasa-caller-6e2ee8b5bbd3.herokuapp.com/ws"

    private var isConnected = false
    private var currentUserId: String? = null

    // -------------------
    // Connect / Disconnect
    // -------------------
    fun connect(userId: String) {
        if (isConnected) {
            Log.w("WebSocketManager", "Already connected as $userId.")
            return
        }

        currentUserId = userId
        val request = Request.Builder()
            .url("$webSocketUrl?userId=$userId")
            .build()

        Log.i("WebSocketManager", "🌐 Connecting to WebSocket as user: $userId")

        webSocket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                Log.i("WebSocketManager", "✅ Connected to signaling server.")
                sendJoinMessage(userId)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d("WebSocketManager", "📩 Received: $text")
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type")

                    when (type.lowercase()) {
                        "offer", "answer", "candidate", "error",
                        "call_request", "call_accept", "call_reject" -> {
                            val msg = parseSignalingMessage(json)
                            _signalingMessages.tryEmit(msg)
                        }
                        "user_joined", "user_left" -> {
                            Log.d("WebSocketManager", "User event: $type (${json.optString("userId")})")
                            _messages.tryEmit(text)
                        }
                        else -> _messages.tryEmit(text)
                    }
                } catch (e: Exception) {
                    Log.e("WebSocketManager", "❌ Error parsing message: ${e.message}")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.i("WebSocketManager", "🧩 WebSocket closing: $code / $reason")
                isConnected = false
                webSocket.close(1000, null)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e("WebSocketManager", "⚠️ WebSocket error: ${t.message}", t)
                isConnected = false
                this@WebSocketManager.webSocket = null
            }
        })
    }

    fun disconnect() {
        if (isConnected) {
            Log.i("WebSocketManager", "🔌 Disconnecting WebSocket.")
            webSocket?.close(1000, "User left call")
        }
        webSocket = null
        isConnected = false
    }

    // -------------------
    // Send Messages
    // -------------------
    fun sendMessage(message: String) {
        if (!isConnected) {
            Log.w("WebSocketManager", "⚠️ Attempted to send message before connection.")
            return
        }
        Log.d("WebSocketManager", "➡️ Sending raw message: $message")
        webSocket?.send(message)
    }

    fun sendSignalingMessage(
        type: String,
        targetUserId: String,
        sdp: String? = null,
        candidateInfo: Map<String, Any>? = null
    ) {
        val json = JSONObject().apply {
            put("type", type)
            put("fromUserId", currentUserId)
            put("targetUserId", targetUserId)
            sdp?.let { put("sdp", it) }
            candidateInfo?.let {
                put("candidate", it["candidate"])
                put("sdpMid", it["sdpMid"])
                put("sdpMLineIndex", it["sdpMLineIndex"])
            }
        }

        Log.i("WebSocketManager", "📡 Sending signaling message: $type to $targetUserId")
        sendMessage(json.toString())
    }

    fun sendCallRequest(targetUserId: String, isVideo: Boolean) {
        val json = JSONObject().apply {
            put("type", "call_request")
            put("fromUserId", currentUserId)
            put("targetUserId", targetUserId)
            put("isVideo", isVideo)
        }
        Log.i("WebSocketManager", "📡 Sending call request to $targetUserId")
        sendMessage(json.toString())
    }

    fun sendData(data: JSONObject, targetUserId: String) {
        val message = JSONObject().apply {
            put("type", "data_message")
            put("fromUserId", currentUserId)
            put("targetUserId", targetUserId)
            put("payload", data)
        }
        sendMessage(message.toString())
    }

    private fun sendJoinMessage(userId: String) {
        val message = JSONObject().apply {
            put("type", "join")
            put("userId", userId)
        }
        sendMessage(message.toString())
    }

    // -------------------
    // Parsing
    // -------------------
    private fun parseSignalingMessage(json: JSONObject): SignalingMessage {
        val typeString = json.optString("type").uppercase()
        val sdp = json.optString("sdp", null)
        val fromUserId = json.optString("fromUserId", null)
        val errorMsg = json.optString("message", null)
        val type = try {
            SignalingMessageType.valueOf(typeString)
        } catch (e: IllegalArgumentException) {
            Log.w("WebSocketManager", "Unknown signaling type: $typeString")
            SignalingMessageType.UNKNOWN
        }

        val candidateData = if (type == SignalingMessageType.CANDIDATE) {
            val candidate = json.optString("candidate", null)
            val sdpMid = json.optString("sdpMid", null)
            val sdpMLineIndex = json.optInt("sdpMLineIndex", -1)
            if (candidate != null && sdpMid != null && sdpMLineIndex >= 0)
                CandidateData(candidate, sdpMid, sdpMLineIndex)
            else null
        } else null

        return SignalingMessage(
            type = type,
            sdp = sdp,
            candidate = candidateData,
            fromUserId = fromUserId,
            error = if (type == SignalingMessageType.ERROR) errorMsg else null
        )
    }
}
