package xyz.yenkasa.app.ui.chat

import io.socket.emitter.Emitter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.network.SocketManager

interface ChatSocketListener {
    fun onMessageReceived(message: ChatMessage)
    fun onMessageEdited(message: ChatMessage)
    fun onMessageDeleted(messageId: String)
    fun onPresenceChanged(isOnline: Boolean, statusText: String)
}

class ChatSocketController(
    private val senderId: String,
    private val roomId: String,
    private val listener: ChatSocketListener
) {

    private var presenceListenersAttached = false
    private var realtimeListenersAttached = false
    private var onlineUsersListener: Emitter.Listener? = null
    private var userStatusChangedListener: Emitter.Listener? = null
    private var presenceUpdateListener: Emitter.Listener? = null
    private var messageCreatedListener: Emitter.Listener? = null
    private var messageEditedListener: Emitter.Listener? = null
    private var messageDeletedListener: Emitter.Listener? = null

    private var receiverParticipant: Participant? = null

    fun setReceiverParticipant(participant: Participant?) {
        receiverParticipant = participant
    }

    fun setupListeners() {
        if (realtimeListenersAttached) return
        SocketManager.ensureConnected(senderId)
        joinRealtimeChatRoom()

        messageCreatedListener = SocketManager.on("messageCreated") { data ->
            val incoming = parseSocketMessage(data) ?: return@on
            if (incoming.roomId != roomId) return@on
            listener.onMessageReceived(incoming)
        }

        messageEditedListener = SocketManager.on("messageEdited") { data ->
            val edited = parseSocketMessage(data) ?: return@on
            if (edited.roomId != roomId) return@on
            listener.onMessageEdited(edited)
        }

        messageDeletedListener = SocketManager.on("messageDeleted") { data ->
            val json = parseSocketJson(data) ?: return@on
            if (json.optString("roomId") != roomId) return@on
            val deletedMessageId = json.optString("messageId")
            if (deletedMessageId.isBlank()) return@on
            listener.onMessageDeleted(deletedMessageId)
        }

        realtimeListenersAttached = true
    }

    fun setupPresenceListeners() {
        if (presenceListenersAttached) return
        SocketManager.ensureConnected(senderId)
        SocketManager.emitUserConnected(senderId)

        onlineUsersListener = SocketManager.on("getOnlineUsers") { data ->
            val receiverId = receiverParticipant?._id ?: return@on
            val isOnline = isReceiverOnline(data, receiverId)
            listener.onPresenceChanged(
                isOnline,
                if (isOnline) ChatConstants.STATUS_ONLINE else ChatConstants.STATUS_OFFLINE
            )
        }

        userStatusChangedListener = SocketManager.on("userStatusChanged") { data ->
            handlePresenceChangedEvent(data)
        }

        presenceUpdateListener = SocketManager.on("presence:update") { data ->
            handlePresenceChangedEvent(data)
        }

        presenceListenersAttached = true
        requestOnlineUsers()
    }

    fun requestOnlineUsers() {
        SocketManager.requestOnlineUsers()
    }

    fun removeListeners() {
        SocketManager.off("getOnlineUsers", onlineUsersListener)
        SocketManager.off("userStatusChanged", userStatusChangedListener)
        SocketManager.off("presence:update", presenceUpdateListener)
        onlineUsersListener = null
        userStatusChangedListener = null
        presenceUpdateListener = null
        presenceListenersAttached = false

        SocketManager.off("messageCreated", messageCreatedListener)
        SocketManager.off("messageEdited", messageEditedListener)
        SocketManager.off("messageDeleted", messageDeletedListener)
        messageCreatedListener = null
        messageEditedListener = null
        messageDeletedListener = null
        realtimeListenersAttached = false
        leaveRealtimeChatRoom()
    }

    private fun joinRealtimeChatRoom() {
        val payload = org.json.JSONObject()
            .put("roomId", roomId)
            .put("userId", senderId)
        SocketManager.emit("joinChatRoom", payload)
    }

    private fun leaveRealtimeChatRoom() {
        SocketManager.emit("leaveChatRoom", roomId)
    }

    private fun parseSocketMessage(data: Any): ChatMessage? {
        val json = parseSocketJson(data) ?: return null
        return com.google.gson.Gson().fromJson(json.toString(), ChatMessage::class.java)
    }

    private fun parseSocketJson(data: Any): org.json.JSONObject? {
        return when (data) {
            is org.json.JSONObject -> data
            else -> runCatching { org.json.JSONObject(data.toString()) }.getOrNull()
        }
    }

    private fun isReceiverOnline(data: Any, receiverId: String): Boolean {
        if (data is org.json.JSONObject) {
            val eventUserId = data.optString("userId", data.optString("_id", ""))
            if (eventUserId == receiverId) {
                return data.optBoolean("isOnline", data.optBoolean("online", false))
            }
        }

        parseOnlineUsersArray(data)?.let { onlineUsers ->
            for (i in 0 until onlineUsers.length()) {
                when (val item = onlineUsers.opt(i)) {
                    is org.json.JSONObject -> {
                        val id = item.optString("userId", item.optString("_id", item.optString("id", "")))
                        if (id == receiverId) return true
                    }
                    else -> if (item?.toString() == receiverId) return true
                }
            }
            return false
        }

        return when (data) {
            is List<*> -> data.any { it?.toString() == receiverId }
            is Array<*> -> data.any { it?.toString() == receiverId }
            else -> data.toString()
                .removePrefix("[")
                .removeSuffix("]")
                .split(",")
                .map { it.trim().trim('"') }
                .contains(receiverId)
        }
    }

    private fun handlePresenceChangedEvent(data: Any) {
        val json = when (data) {
            is org.json.JSONObject -> data
            else -> runCatching { org.json.JSONObject(data.toString()) }.getOrNull()
        } ?: return

        val updatedUserId = json.optString("userId", json.optString("_id", ""))
        val receiverId = receiverParticipant?._id ?: return
        if (updatedUserId != receiverId) return

        val isOnline = json.optBoolean("isOnline", json.optBoolean("online", false))
        val statusText = json.optString(
            "statusText",
            if (isOnline) ChatConstants.STATUS_ONLINE else ChatConstants.STATUS_OFFLINE
        )

        listener.onPresenceChanged(isOnline, statusText)
    }
    
    private fun parseOnlineUsersArray(data: Any): org.json.JSONArray? {
        return when (data) {
            is org.json.JSONArray -> data
            is org.json.JSONObject -> {
                data.optJSONArray("onlineUsers")
                    ?: data.optJSONArray("users")
                    ?: data.optJSONArray("userIds")
            }
            else -> runCatching { org.json.JSONArray(data.toString()) }.getOrNull()
        }
    }
}
