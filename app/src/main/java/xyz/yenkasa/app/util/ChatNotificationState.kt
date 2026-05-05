package xyz.yenkasa.app.util

import android.content.Context

object ChatNotificationState {
    @Volatile
    private var activeRoomId: String? = null
    private val recentMessageIds = ArrayDeque<String>()
    private val recentMessageIdSet = mutableSetOf<String>()

    fun setActiveRoom(roomId: String?) {
        activeRoomId = roomId?.takeIf { it.isNotBlank() }
    }

    fun clearActiveRoom(roomId: String?) {
        if (activeRoomId == roomId) {
            activeRoomId = null
        }
    }

    fun shouldSuppressNotification(
        context: Context,
        senderId: String?,
        roomId: String?,
        messageId: String?
    ): Boolean {
        val currentUserId = TokenManager.getUserId(context).orEmpty()
        if (!senderId.isNullOrBlank() && senderId == currentUserId) return true
        if (!roomId.isNullOrBlank() && roomId == activeRoomId) return true
        if (messageId.isNullOrBlank()) return false

        synchronized(recentMessageIds) {
            if (!recentMessageIdSet.add(messageId)) return true
            recentMessageIds.addLast(messageId)
            while (recentMessageIds.size > MAX_RECENT_MESSAGE_IDS) {
                recentMessageIdSet.remove(recentMessageIds.removeFirst())
            }
        }
        return false
    }

    private const val MAX_RECENT_MESSAGE_IDS = 80
}
