package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log
import com.google.gson.Gson
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.ChatRoom
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

object ChatCacheManager {
    private const val TAG = "ChatCacheManager"
    private const val CACHE_SCHEMA_VERSION = 1
    private const val MAX_MESSAGES_PER_ROOM = 300
    private const val MAX_ROOMS_PER_USER = 200
    private const val CACHE_DIR_NAME = "chat_cache_v1"

    private val gson = Gson()
    private val ioExecutor = Executors.newSingleThreadExecutor()

    private data class MessagesEnvelope(
        val schemaVersion: Int = CACHE_SCHEMA_VERSION,
        val roomId: String = "",
        val cachedAt: Long = System.currentTimeMillis(),
        val messages: List<ChatMessage> = emptyList()
    )

    private data class RoomsEnvelope(
        val schemaVersion: Int = CACHE_SCHEMA_VERSION,
        val userId: String = "",
        val cachedAt: Long = System.currentTimeMillis(),
        val rooms: List<ChatRoom> = emptyList()
    )

    fun getCachedMessages(context: Context, roomId: String): List<ChatMessage> {
        if (roomId.isBlank()) return emptyList()
        val file = messageFile(context, roomId)
        return readEnvelope(file, MessagesEnvelope::class.java)
            ?.takeIf { it.schemaVersion == CACHE_SCHEMA_VERSION && it.roomId == roomId }
            ?.messages
            .orEmpty()
    }

    fun saveMessagesAsync(context: Context, roomId: String, messages: List<ChatMessage>) {
        val appContext = context.applicationContext
        ioExecutor.execute {
            saveMessages(appContext, roomId, messages)
        }
    }

    fun saveMessages(context: Context, roomId: String, messages: List<ChatMessage>) {
        if (roomId.isBlank()) return
        val safeMessages = dedupeMessages(messages)
            .takeLast(MAX_MESSAGES_PER_ROOM)
        val envelope = MessagesEnvelope(
            roomId = roomId,
            messages = safeMessages
        )
        writeEnvelope(messageFile(context, roomId), envelope)
    }

    fun getCachedChatRooms(context: Context, userId: String): List<ChatRoom> {
        return getCachedRooms(context, userId, "private_rooms")
    }

    fun saveChatRoomsAsync(context: Context, userId: String, rooms: List<ChatRoom>) {
        saveRoomsAsync(context, userId, rooms, "private_rooms")
    }

    fun getCachedGroups(context: Context, userId: String): List<ChatRoom> {
        return getCachedRooms(context, userId, "groups")
    }

    fun saveGroupsAsync(context: Context, userId: String, groups: List<ChatRoom>) {
        saveRoomsAsync(context, userId, groups, "groups")
    }

    private fun getCachedRooms(context: Context, userId: String, bucket: String): List<ChatRoom> {
        if (userId.isBlank()) return emptyList()
        val file = roomsFile(context, userId, bucket)
        return readEnvelope(file, RoomsEnvelope::class.java)
            ?.takeIf { it.schemaVersion == CACHE_SCHEMA_VERSION && it.userId == userId }
            ?.rooms
            .orEmpty()
    }

    private fun saveRoomsAsync(context: Context, userId: String, rooms: List<ChatRoom>, bucket: String) {
        val appContext = context.applicationContext
        ioExecutor.execute {
            if (userId.isBlank()) return@execute
            val safeRooms = rooms
                .distinctBy { it._id }
                .sortedWith(
                    compareByDescending<ChatRoom> { it.lastActivityTimeMillis }
                        .thenByDescending { it.unreadCount }
                )
                .take(MAX_ROOMS_PER_USER)
            val envelope = RoomsEnvelope(
                userId = userId,
                rooms = safeRooms
            )
            writeEnvelope(roomsFile(appContext, userId, bucket), envelope)
        }
    }

    private fun dedupeMessages(messages: List<ChatMessage>): List<ChatMessage> {
        val ordered = LinkedHashMap<String, ChatMessage>()
        messages.forEach { message ->
            ordered[messageCacheKey(message)] = message
        }
        return ordered.values.toList()
    }

    private fun messageCacheKey(message: ChatMessage): String {
        message.id?.takeIf { it.isNotBlank() }?.let { return "id:$it" }
        return listOf(
            message.roomId.orEmpty(),
            message.senderId.orEmpty(),
            message.timestamp.orEmpty(),
            message.text.orEmpty(),
            message.imageUrl.orEmpty(),
            message.audioUrl.orEmpty(),
            message.videoUrl.orEmpty(),
            message.fileUrl.orEmpty(),
            message.contactInfo.orEmpty()
        ).joinToString(separator = "|", prefix = "fallback:")
    }

    private fun <T> readEnvelope(file: File, envelopeClass: Class<T>): T? {
        if (!file.exists()) return null
        return try {
            file.reader().use { reader ->
                gson.fromJson(reader, envelopeClass)
            }
        } catch (error: Exception) {
            Log.w(TAG, "Ignoring unreadable chat cache: ${file.name}", error)
            runCatching { file.delete() }
            null
        }
    }

    private fun writeEnvelope(file: File, envelope: Any) {
        try {
            file.parentFile?.mkdirs()
            val tempFile = File(file.parentFile, "${file.name}.tmp")
            tempFile.writeText(gson.toJson(envelope))
            if (file.exists() && !file.delete()) {
                Log.w(TAG, "Could not replace existing cache file: ${file.name}")
            }
            if (!tempFile.renameTo(file)) {
                Log.w(TAG, "Could not finalize cache file: ${file.name}")
                tempFile.delete()
            }
        } catch (error: Exception) {
            Log.w(TAG, "Failed to write chat cache: ${file.name}", error)
        }
    }

    private fun messageFile(context: Context, roomId: String): File {
        return File(cacheDir(context), "messages_${sha256(roomId)}.json")
    }

    private fun roomsFile(context: Context, userId: String, bucket: String): File {
        return File(cacheDir(context), "${bucket}_${sha256(userId)}.json")
    }

    private fun cacheDir(context: Context): File {
        return File(context.noBackupFilesDir, CACHE_DIR_NAME).apply { mkdirs() }
    }

    private fun sha256(value: String): String {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
