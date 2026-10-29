package xyz.yenkasa.app.ui.chat

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService

/** Owns chat data access so Activities do not coordinate Retrofit directly. */
class ChatRepository(
    private val api: ApiService = ApiClient.apiService
) {
    suspend fun getMessages(roomId: String): Result<List<ChatMessage>> = withContext(Dispatchers.IO) {
        runCatching {
            require(roomId.isNotBlank()) { "Room ID cannot be blank" }
            val response = api.getMessages(roomId).execute()
            if (!response.isSuccessful) {
                error("Unable to load messages (${response.code()})")
            }
            response.body().orEmpty()
        }
    }

    suspend fun markMessagesAsRead(roomId: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val response = api.markMessagesAsRead(roomId).execute()
            if (!response.isSuccessful) error("Unable to mark messages as read (${response.code()})")
        }
    }
}
