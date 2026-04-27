package xyz.yenkasa.app.network

import android.util.Log
import xyz.yenkasa.app.model.*
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URISyntaxException

object SocketManager {

    private var socket: Socket? = null
    private var currentUserId: String? = null
    private var coreListenersAttached = false
    private const val TAG = "SocketManager"
    private val SOCKET_URL = ApiClient.BASE_URL
        .removeSuffix("/api/")
        .removeSuffix("/api")
        .removeSuffix("api/")

    val instance: Socket?
        get() = socket

    // ------------------------------------------------------------------
    // 🔹 Connection Management
    // ------------------------------------------------------------------
    fun connect(userId: String?) {
        if (userId.isNullOrEmpty()) {
            Log.w(TAG, "Cannot connect socket: userId is null or empty.")
            return
        }

        try {
            if (currentUserId != null && currentUserId != userId) {
                disconnect()
            }

            currentUserId = userId

            if (socket == null) {
                val opts = IO.Options().apply {
                    reconnection = true
                    reconnectionAttempts = Int.MAX_VALUE
                    reconnectionDelay = 1000
                    reconnectionDelayMax = 10000
                    timeout = 20000
                    forceNew = false
                    transports = arrayOf("websocket", "polling")
                }
                socket = IO.socket(SOCKET_URL, opts)
                coreListenersAttached = false
            }

            attachCoreListeners()

            if (socket?.connected() == true) {
                emitUserConnected(userId)
                requestOnlineUsers()
                return
            }

            socket?.connect()
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Socket connection failed: ${e.message}", e)
        }
    }

    private fun attachCoreListeners() {
        if (coreListenersAttached) return

        socket?.apply {
            off(Socket.EVENT_CONNECT)
            off(Socket.EVENT_DISCONNECT)
            off(Socket.EVENT_CONNECT_ERROR)

            on(Socket.EVENT_CONNECT) {
                val userId = currentUserId
                if (!userId.isNullOrEmpty()) {
                    Log.i(TAG, "✅ Socket connected to $SOCKET_URL.")
                    emitUserConnected(userId)
                    requestOnlineUsers()
                }
            }

            on(Socket.EVENT_DISCONNECT) { args ->
                val reason = args.firstOrNull()?.toString().orEmpty()
                Log.w(TAG, "⚠️ Socket disconnected. reason=$reason")
            }

            on(Socket.EVENT_CONNECT_ERROR) { args ->
                val reason = args.firstOrNull()?.toString().orEmpty()
                Log.e(TAG, "❌ Socket connect error: $reason")
            }
        }

        coreListenersAttached = true
    }

    fun ensureConnected(userId: String?) {
        if (!isConnected()) connect(userId)
    }

    fun disconnect() {
        try {
            if (socket?.connected() == true) {
                socket?.disconnect()
                Log.i(TAG, "🔌 Socket disconnected manually.")
            }
            socket?.off()
            socket = null
            currentUserId = null
            coreListenersAttached = false
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket", e)
        }
    }

    fun cleanup() {
        try {
            socket?.off()
            disconnect()
            Log.i(TAG, "🧹 Socket cleaned and listeners removed.")
        } catch (e: Exception) {
            Log.e(TAG, "Error during socket cleanup", e)
        }
    }

    fun isConnected(): Boolean = socket?.connected() ?: false

    // ------------------------------------------------------------------
    // 🔹 Event Handling
    // ------------------------------------------------------------------
    fun on(event: String, listener: (data: Any) -> Unit) {
        if (socket == null && !currentUserId.isNullOrEmpty()) {
            connect(currentUserId)
        }
        socket?.on(event) { args ->
            if (args.isNotEmpty()) listener(args[0])
        }
    }

    fun off(event: String) {
        socket?.off(event)
    }

    fun emit(event: String, data: Any) {
        try {
            if (socket?.connected() != true && !currentUserId.isNullOrEmpty()) {
                connect(currentUserId)
            }
            socket?.emit(event, data)
            Log.d(TAG, "📡 Emitted $event with $data")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting $event", e)
        }
    }

    // ------------------------------------------------------------------
    // 🔹 User connection events
    // ------------------------------------------------------------------
    fun emitUserConnected(userId: String) {
        try {
            socket?.emit("userOnline", userId)
            Log.d(TAG, "👤 User connected: $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting userOnline", e)
        }
    }

    fun emitUserDisconnected(userId: String) {
        try {
            socket?.emit("userOffline", userId)
            Log.d(TAG, "👤 User disconnected: $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting userOffline", e)
        }
    }

    fun requestOnlineUsers() {
        try {
            socket?.emit("requestOnlineUsers")
            Log.d(TAG, "📡 Requested online users")
        } catch (e: Exception) {
            Log.e(TAG, "Error requesting online users", e)
        }
    }

    // ------------------------------------------------------------------
    // 🔹 JSON Parsing Helpers (Aligned to new Post model)
    // ------------------------------------------------------------------
    fun parseUser(json: JSONObject?): UserBasic {
        if (json == null) return UserBasic("", "Unknown", null, false, null)
        return UserBasic(
            id = json.optString("_id"),
            username = json.optString("username", "Unknown"),
            profileImage = json.optString("profileImage", null),
            verified = json.optBoolean("verified", false),
            roleName = json.optString("roleName", null)
        )
    }

    fun parseCommunity(json: JSONObject?): CommunityBasic? {
        if (json == null) return null
        return CommunityBasic(
            id = json.optString("_id"),
            name = json.optString("name", "general"),
            displayName = json.optString("displayName", "General")
        )
    }

    fun parsePost(json: JSONObject?): Post? {
        if (json == null) return null
        return try {
            Post(
                _id = json.optString("_id"),
                userId = parseUser(json.optJSONObject("userId")),
                communityId = parseCommunity(json.optJSONObject("communityId")),
                caption = json.optString("text", json.optString("caption", null)),
                imageUrl = json.optString("imageUrl", null),
                imageUrls = json.optJSONArray("imageUrls")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }.filter { it.isNotBlank() }
                }.orEmpty(),
                videoUrl = json.optString("videoUrl", null),
                audioUrl = json.optString("audioUrl", null),
                textBackgroundColor = json.optString("textBackgroundColor", null),
                mentions = json.optJSONArray("mentions")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }
                },
                likeCount = json.optInt("likeCount", 0),
                commentCount = json.optInt("commentCount", 0),
                shareCount = json.optInt("shareCount", 0),
                viewCount = json.optInt("viewCount", 0),
                coinsEarned = json.optInt("coinsEarned", 0),
                isActive = json.optBoolean("isActive", true),
                isPinned = json.optBoolean("isPinned", false),
                visibility = json.optString("visibility", "public"),
                status = json.optString("status", null),
                isApproved = json.optBoolean("isApproved", false),
                tags = json.optJSONArray("tags")?.let { arr ->
                    List(arr.length()) { i -> arr.optString(i) }
                } ?: emptyList(),
                location = json.optString("location", null),
                createdAt = json.optString("createdAt"),
                updatedAt = json.optString("updatedAt", null),
                likedByUser = json.optBoolean("likedByUser", json.optBoolean("likedByCurrentUser", false)),
                comments = null // or handle separately if needed
            )
        } catch (e: Exception) {
            Log.e(TAG, "⚠️ Error parsing post JSON: ${e.message}", e)
            null
        }
    }
}
