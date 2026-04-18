package xyz.yenkasa.app.webrtc

import android.content.Context
import android.util.Log
import xyz.yenkasa.app.util.TokenManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import okhttp3.*
import okio.ByteString
import org.json.JSONObject

class WebSocketManager {

    private var webSocket: WebSocket? = null
    private val client = OkHttpClient.Builder()
        .pingInterval(20, java.util.concurrent.TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 10)
    val messages: SharedFlow<String> = _messages

    private val _signalingMessages = MutableSharedFlow<SignalingMessage>(extraBufferCapacity = 10)
    val signalingMessages: SharedFlow<SignalingMessage> = _signalingMessages

    private val _connectionState = MutableSharedFlow<Boolean>(replay = 1)
    val connectionState: SharedFlow<Boolean> = _connectionState

    private val webSocketUrl = "wss://yenkasa-caller-6e2ee8b5bbd3.herokuapp.com/ws"

    private var isConnected = false
    private var currentUserId: String? = null
    private var currentUserName: String? = null
    private var currentUserPhoto: String? = null
    private var heartbeatJob: Job? = null
    private var reconnectJob: Job? = null
    private var isConnecting = false

    companion object {
        private const val TAG = "WebSocketManager"
        private const val HEARTBEAT_INTERVAL_MS = 25_000L
        private const val RECONNECT_DELAY_MS = 5_000L
    }

    // ----------------------------------------------------------
    // 🔌 CONNECT / DISCONNECT
    // ----------------------------------------------------------
    fun connect(context: Context) {
        val appContext = context.applicationContext
        val userId = TokenManager.getUserId(appContext)
        if (userId.isNullOrBlank()) {
            Log.e(TAG, "❌ Cannot connect: No userId found in TokenManager")
            return
        }

        if (isConnected && currentUserId == userId) {
            Log.w(TAG, "⚠️ Already connected as $currentUserId")
            return
        }

        if (isConnecting && currentUserId == userId) {
            Log.w(TAG, "⚠️ WebSocket connect already in progress for $currentUserId")
            return
        }

        if (currentUserId != null && currentUserId != userId) {
            disconnect()
        }

        stopReconnect()
        isConnecting = true
        currentUserId = userId
        currentUserName = TokenManager.getUsername(appContext)
        currentUserPhoto = TokenManager.getProfilePicUrl(appContext)

        val request = Request.Builder()
            .url("$webSocketUrl?_id=$userId") // ✅ Backend expects _id param
            .build()

        Log.i(TAG, "🌐 Connecting to WebSocket as user: $userId")

        webSocket = client.newWebSocket(request, object : WebSocketListener() {

            override fun onOpen(webSocket: WebSocket, response: Response) {
                isConnecting = false
                isConnected = true
                _connectionState.tryEmit(true)
                Log.i(TAG, "✅ Connected to signaling server.")
                stopReconnect()
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "📩 Received: $text")
                try {
                    val json = JSONObject(text)
                    val type = json.optString("type").lowercase()

                    when (type) {
                        "offer", "answer", "candidate", "error",
                        "call_request", "call_accept", "call_reject", "user_busy" -> {
                            val msg = parseSignalingMessage(json)
                            _signalingMessages.tryEmit(msg)
                        }

                        "user_joined", "user_left" -> {
                            Log.d(TAG, "👥 User event: $type (${json.optString("_id")})")
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
                isConnecting = false
                isConnected = false
                _connectionState.tryEmit(false)
                stopHeartbeat()
                // ❌ DO NOT call webSocket.close() here — it triggers premature termination
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.i(TAG, "🔌 WebSocket closed: $code / $reason")
                isConnecting = false
                isConnected = false
                this@WebSocketManager.webSocket = null
                _connectionState.tryEmit(false)
                stopHeartbeat()
                scheduleReconnect(appContext)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "⚠️ WebSocket error: ${t.message}", t)
                isConnecting = false
                isConnected = false
                this@WebSocketManager.webSocket = null
                _connectionState.tryEmit(false)
                stopHeartbeat()
                scheduleReconnect(appContext)
            }
        })
    }

    fun disconnect() {
        if (webSocket != null) {
            Log.i(TAG, "🔌 Disconnecting WebSocket.")
            webSocket?.close(1000, "User left call")
        }
        stopHeartbeat()
        stopReconnect()
        webSocket = null
        isConnecting = false
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


                            webSocket?.send(ByteString.EMPTY)
                    Log.d(TAG, "💓 Real WebSocket ping sent (ByteString)")

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
    fun sendCallAcceptWithRoom(receiverId: String?, roomUrl: String?, token: String?) {
        if (receiverId.isNullOrEmpty() || roomUrl.isNullOrEmpty() || token.isNullOrEmpty()) {
            Log.e("WebSocketManager", "❌ Skipping CALL_ACCEPT_WITH_ROOM — missing data (receiverId=$receiverId, roomUrl=$roomUrl, token=$token)")
            return
        }

        try {
            val json = JSONObject().apply {
                put("type", "call_accept_with_room")
                put("toUserId", receiverId)
                put("roomUrl", roomUrl)
                put("token", token)
            }

            webSocket?.send(json.toString())
            Log.d("WebSocketManager", "✅ Sent CALL_ACCEPT_WITH_ROOM to $receiverId")
        } catch (e: Exception) {
            Log.e("WebSocketManager", "Error sending CALL_ACCEPT_WITH_ROOM: ${e.message}", e)
        }
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

    // ✅ WebRTC signaling
    fun sendSignalingMessage(
        type: String,
        receiverId: String,
        sdp: String? = null,
        candidateInfo: Map<String, Any>? = null
    ) {
        val json = JSONObject().apply {
            put("type", type)
            put("fromUserId", currentUserId)
            put("_id", receiverId) // backend expects _id
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

    // ✅ Send Call Request (with name and photo)
// ✅ Unified & fixed version
    fun sendCallRequest(
        receiverId: String,
        isVideo: Boolean,
        roomUrl: String? = null,
        token: String? = null
    ) {
        val json = JSONObject().apply {
            put("type", "CALL_REQUEST") // MUST match backend
            put("fromUserId", currentUserId)
            put("_id", receiverId)
            put("isVideo", isVideo)
            put("callerName", currentUserName ?: "Unknown")
            put("callerPhoto", currentUserPhoto ?: "")
            if (!roomUrl.isNullOrEmpty()) put("roomUrl", roomUrl)
            if (!token.isNullOrEmpty()) put("token", token)
        }

        Log.i(TAG, "📞 Sending CALL_REQUEST to $receiverId (video=$isVideo, hasRoom=${!roomUrl.isNullOrEmpty()})")
        sendMessage(json.toString())
    }
    // ✅ Send CALL_ACCEPT message
    fun sendCallAccept(receiverId: String) {
        try {
            val json = JSONObject().apply {
                put("type", "CALL_ACCEPT")   // must match backend switch-case
                put("fromUserId", currentUserId)
                put("_id", receiverId)
            }
            webSocket?.send(json.toString())
            Log.i(TAG, "✅ Sent CALL_ACCEPT to $receiverId")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending CALL_ACCEPT: ${e.message}", e)
        }
    }

    fun sendCallReject(receiverId: String) {
        try {
            val json = JSONObject().apply {
                put("type", "call_reject")
                put("fromUserId", currentUserId)
                put("_id", receiverId)
            }
            webSocket?.send(json.toString())
            Log.i(TAG, "🚫 Sent CALL_REJECT to $receiverId")
        } catch (e: Exception) {
            Log.e(TAG, "Error sending CALL_REJECT: ${e.message}", e)
        }
    }

    // ----------------------------------------------------------
    // 🧩 PARSING
    // ----------------------------------------------------------
    private fun parseSignalingMessage(json: JSONObject): SignalingMessage {
        val typeString = json.optString("type").uppercase()
        val sdp = json.optString("sdp", null)
        val fromUserId = json.optString("fromUserId", null)
        val callerName = json.optString("callerName", null)
        val callerPhoto = json.optString("callerPhoto", null)
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
            error = if (type == SignalingMessageType.ERROR) errorMsg else null,
            // 👇 ADD THESE FIELDS
            roomUrl = json.optString("roomUrl", null),
            token = json.optString("token", null)
        ).apply {
            if (type == SignalingMessageType.CALL_REQUEST) {
                Log.d(TAG, "📞 Incoming call from $callerName ($fromUserId)")
            }


        }
    }
}
