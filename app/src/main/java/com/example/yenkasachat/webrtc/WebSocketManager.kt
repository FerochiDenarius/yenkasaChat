package com.example.yenkasachat.webrtc

import android.content.Context
import android.util.Log
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.*
import org.json.JSONObject

class WebSocketManager {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder().build()

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 10)
    val messages: SharedFlow<String> = _messages

    private val _signalingMessages = MutableSharedFlow<SignalingMessage>(extraBufferCapacity = 10)
    val signalingMessages: SharedFlow<SignalingMessage> = _signalingMessages

    private val _connectionState = MutableSharedFlow<Boolean>(replay = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState

    private val webSocketUrl = "wss://yenkasa-caller-6e2ee8b5bbd3.herokuapp.com/ws"

    private var isConnected = false
    private var currentUserId: String? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null

    companion object {
        private const val TAG = "WebSocketManager"
        private const val HEARTBEAT_INTERVAL_MS = 25_000L
        private const val RECONNECT_DELAY_MS = 5_000L
    }

    // ----------------------------------------------------------
    // 🔌 CONNECT / DISCONNECT
    // ----------------------------------------------------------
    fun connect(context: Context) {
        if (isConnected) {
            Log.w(TAG, "⚠️ Already connected as $currentUserId")
            return
        }

        val userId = TokenManager.getUserId(context)
        if (userId.isNullOrBlank()) {
            Log.e(TAG, "❌ Cannot connect: No userId found in TokenManager")
            return
        }

        currentUserId = userId
        val request = Request.Builder()
            // ✅ Backend expects `_id`, not `userId`
            .url("$webSocketUrl?_id=$userId")
            .build()

        Log.i(TAG, "🌐 Connecting to WebSocket as user: $userId")

        webSocket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnected = true
                _connectionState.tryEmit(true)
                Log.i(TAG, "✅ Connected to signaling server.")
                stopReconnect() // stop any reconnection attempt
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "📩 Received: $text")
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
                            Log.d(TAG, "👥 User event: $type (${json.optString("userId")})")
                            _messages.tryEmit(text)
                        }
                        else -> _messages.tryEmit(text)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error parsing message: ${e.message}")
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "🧩 WebSocket closing: $code / $reason")
                isConnected = false
                _connectionState.tryEmit(false)
                stopHeartbeat()
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "🔌 WebSocket closed: $code / $reason")
                isConnected = false
                _connectionState.tryEmit(false)
                stopHeartbeat()
                scheduleReconnect(context)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "⚠️ WebSocket error: ${t.message}", t)
                response?.let {
                    Log.e(TAG, "Server response: ${it.code} / ${it.message}")
                }
                isConnected = false
                _connectionState.tryEmit(false)
                stopHeartbeat()
                scheduleReconnect(context)
            }
        })
    }

    fun disconnect() {
        if (isConnected) {
            Log.i(TAG, "🔌 Disconnecting WebSocket.")
            webSocket?.close(1000, "User left call")
        }
        stopHeartbeat()
        stopReconnect()
        webSocket = null
        isConnected = false
        _connectionState.tryEmit(false)
    }

    // ----------------------------------------------------------
    // 💓 HEARTBEAT (KEEP-ALIVE)
    // ----------------------------------------------------------
    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = CoroutineScope(Dispatchers.IO).launch {
            while (isActive && isConnected) {
                delay(HEARTBEAT_INTERVAL_MS)
                try {
                    webSocket?.send("ping")
                    Log.d(TAG, "💓 Heartbeat ping sent")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Heartbeat error: ${e.message}")
                }
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    // ----------------------------------------------------------
    // 🔁 RECONNECT
    // ----------------------------------------------------------
    private fun scheduleReconnect(context: Context) {
        if (reconnectJob?.isActive == true) return
        reconnectJob = CoroutineScope(Dispatchers.IO).launch {
            Log.w(TAG, "⏳ Reconnecting in ${RECONNECT_DELAY_MS / 1000} seconds...")
            delay(RECONNECT_DELAY_MS)
            connect(context)
        }
    }

    private fun stopReconnect() {
        reconnectJob?.cancel()
        reconnectJob = null
    }

    // ----------------------------------------------------------
    // 🚀 SEND MESSAGES
    // ----------------------------------------------------------
    fun sendMessage(message: String) {
        if (!isConnected) {
            Log.w(TAG, "⚠️ Attempted to send message before connection established.")
            return
        }
        Log.d(TAG, "➡️ Sending raw message: $message")
        webSocket?.send(message)
    }

    fun sendSignalingMessage(
        type: String,
        receiverId: String,
        sdp: String? = null,
        candidateInfo: Map<String, Any>? = null
    ) {
        val json = JSONObject().apply {
            put("type", type)
            put("fromUserId", currentUserId)
            put("receiverId", receiverId)
            sdp?.let { put("sdp", it) }
            candidateInfo?.let {
                put("candidate", it["candidate"])
                put("sdpMid", it["sdpMid"])
                put("sdpMLineIndex", it["sdpMLineIndex"])
            }
        }

        Log.i(TAG, "📡 Sending signaling message: $type to receiver $receiverId")
        sendMessage(json.toString())
    }

    fun sendCallRequest(receiverId: String, isVideo: Boolean) {
        val json = JSONObject().apply {
            put("type", "call_request")
            put("fromUserId", currentUserId)
            put("receiverId", receiverId)
            put("isVideo", isVideo)
        }
        Log.i(TAG, "📡 Sending call request to receiver: $receiverId")
        sendMessage(json.toString())
    }

    fun sendData(data: JSONObject, receiverId: String) {
        val message = JSONObject().apply {
            put("type", "data_message")
            put("fromUserId", currentUserId)
            put("receiverId", receiverId)
            put("payload", data)
        }
        sendMessage(message.toString())
    }

    // ----------------------------------------------------------
    // 🧩 PARSING
    // ----------------------------------------------------------
    private fun parseSignalingMessage(json: JSONObject): SignalingMessage {
        val typeString = json.optString("type").uppercase()
        val sdp = json.optString("sdp", null)
        val fromUserId = json.optString("fromUserId", null)
        val errorMsg = json.optString("message", null)
        val type = try {
            SignalingMessageType.valueOf(typeString)
        } catch (e: IllegalArgumentException) {
            Log.w(TAG, "Unknown signaling type: $typeString")
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
