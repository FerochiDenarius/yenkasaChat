package xyz.yenkasa.app.ui

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.database.Cursor
import android.location.Location
import android.net.Uri
import android.os.Handler
import android.provider.ContactsContract
import android.util.Log
import android.widget.Toast
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.model.ReceiverResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.NotificationHelper
import com.google.android.gms.location.FusedLocationProviderClient
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

/**
 * Interface for ChatActivity to receive updates and requests from ChatActivityHelper.
 */
interface ChatHelperCallback {
    fun showToast(message: String, length: Int)
    fun updateMessages(messages: List<ChatMessage>)
    fun getCurrentMessageList(): List<ChatMessage>
    fun requestHideKeyboard()
    fun requestSendChatMessage(messageData: Map<String, Any>)
    fun checkAndRequestPermission(permission: String): Boolean
    fun requestDeleteConfirmation(messageToDelete: ChatMessage)
    fun requestEditMessage(messageToEdit: ChatMessage, positionInAdapter: Int) {}
    fun requestReplyToMessage(message: ChatMessage) {}
    fun onReceiverParticipantDetailsReady(participant: Participant)
    fun onReceiverParticipantStatusUpdate(isOnline: Boolean, statusText: String)
    fun showDefaultReceiverHeader(defaultName: String?)
}

/**
 * A helper class to handle business logic for ChatActivity.
 */
class ChatActivityHelper(
    private val context: Context,
    private val callback: ChatHelperCallback,
    private val token: String,
    private val senderId: String,
    private val roomId: String,
    private val fusedLocationProviderClient: FusedLocationProviderClient,
    private val uiHandler: Handler
) : OnMessageActionListener {

    private var lastMessageTimestamp: Long = 0L
    private val refreshInterval = 5000L
    private var isFetchingActive = false


    private fun parseTimestamp(timestamp: String?): Long {
        if (timestamp.isNullOrBlank()) return 0L
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return try {
            sdf.parse(timestamp)?.time ?: 0L
        } catch (e: ParseException) {
            Log.e("ChatActivityHelper", "Failed to parse timestamp: $timestamp", e)
            0L
        }
    }

    // --- Message Fetching ---
    fun startFetchingMessagesRepeatedly() {
        if (isFetchingActive) return
        isFetchingActive = true
        fetchMessagesRepeatedlyInternal()
    }

    fun stopFetchingMessages() {
        isFetchingActive = false
        uiHandler.removeCallbacksAndMessages(null)
    }

    private fun fetchMessagesRepeatedlyInternal() {
        if (!isFetchingActive) return
        fetchMessages()
        uiHandler.postDelayed({
            if (isFetchingActive) fetchMessagesRepeatedlyInternal()
        }, refreshInterval)
    }

    private fun fetchMessages() {
        if (roomId.isBlank()) {
            Log.e("ChatActivityHelper", "Room ID is blank.")
            return
        }

        ApiClient.apiService.getMessages(roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    if (!isFetchingActive) return

                    if (response.isSuccessful) {
                        val messages = response.body().orEmpty()

                        if (messages.isNotEmpty()) {
                            // ✅ Parse latest timestamp from the current list
                            val newestTimestampInBatch = messages.mapNotNull { it.timestamp }
                                .maxOfOrNull { parseTimestamp(it) } ?: 0L

                            // ✅ Detect only truly new messages since lastMessageTimestamp
                            val newMessages = messages.filter { parseTimestamp(it.timestamp) > lastMessageTimestamp }

                            // ✅ Notify only if they’re not sent by the current user
                            if (newMessages.isNotEmpty() && lastMessageTimestamp != 0L) {
                                newMessages.filter { it.sender?._id != senderId }.forEach { msg ->
                                    NotificationHelper.showMessageNotification(
                                        context,
                                        msg.sender?.username ?: "Someone",
                                        msg.text ?: msg.imageUrl ?: msg.fileUrl ?: msg.contactInfo ?: "New message"
                                    )
                                }
                            }

                            // ✅ Update last timestamp only if newer exists
                            if (newestTimestampInBatch > lastMessageTimestamp) {
                                lastMessageTimestamp = newestTimestampInBatch
                            }

                            callback.updateMessages(messages.toList())
                        }
                    } else {
                        Log.e("ChatActivityHelper", "Fetch failed: ${parseError(response)}")
                    }
                }

                override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                    if (!isFetchingActive) return
                    Log.e("ChatActivityHelper", "Error fetching messages", t)
                    callback.showToast("Couldn't refresh messages: ${t.message}", Toast.LENGTH_SHORT)
                }
            })
    }

    fun initializeHeaderInformation() {
        if (roomId.isBlank() || senderId.isBlank()) {
            callback.showDefaultReceiverHeader("Chat")
            return
        }

        ApiClient.apiService.getReceiverInfo(roomId).enqueue(object : Callback<ReceiverResponse> {
            override fun onResponse(call: Call<ReceiverResponse>, response: Response<ReceiverResponse>) {
                if (response.isSuccessful) {
                    val receiver = response.body()?.receiver
                    if (receiver != null) {
                        callback.onReceiverParticipantDetailsReady(receiver)
                        callback.onReceiverParticipantStatusUpdate(
                            receiver.resolvedOnline,
                            if (receiver.resolvedOnline) "Online" else "Offline"
                        )
                    } else {
                        callback.showDefaultReceiverHeader("Chat")
                    }
                } else {
                    callback.showDefaultReceiverHeader("Chat")
                }
            }

            override fun onFailure(call: Call<ReceiverResponse>, t: Throwable) {
                callback.showDefaultReceiverHeader("Chat")
            }
        })
    }

    fun onMessageSentByHandler(message: ChatMessage) {
        val currentMessages = callback.getCurrentMessageList().toMutableList()
        if (currentMessages.none { it.id == message.id }) {
            currentMessages.add(message)
            callback.updateMessages(currentMessages)
            lastMessageTimestamp = parseTimestamp(message.timestamp)
        }
    }

    fun onErrorFromHandler(error: String) {
        callback.showToast("Error: $error", Toast.LENGTH_LONG)
        Log.e("ChatActivityHelper", error)
    }

    // --- OnMessageActionListener Implementations ---
    override fun onCopyText(message: ChatMessage) {
        message.text?.let {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("messageText", it))
            callback.showToast("Message copied", Toast.LENGTH_SHORT)
        }
    }

    override fun onDeleteMessage(message: ChatMessage, positionInAdapter: Int) {
        if (message.sender?._id != senderId) {
            callback.showToast("You can only delete your own messages.", Toast.LENGTH_SHORT)
            return
        }
        message.id?.let {
            callback.requestDeleteConfirmation(message)
        } ?: callback.showToast("Cannot delete: message has no ID.", Toast.LENGTH_SHORT)
    }

    suspend fun confirmDeleteMessageOnServer(messageToDelete: ChatMessage) {
        val messageId = messageToDelete.id ?: return withContext(Dispatchers.Main) {
            callback.showToast("Error: Message ID missing for deletion.", Toast.LENGTH_SHORT)
        }

        try {
            val response = ApiClient.apiService.deleteMessage(messageId, "Bearer $token")
            if (response.isSuccessful) {
                withContext(Dispatchers.Main) {
                    val updatedList = callback.getCurrentMessageList().filter { it.id != messageId }
                    callback.updateMessages(updatedList)
                    callback.showToast("Message deleted", Toast.LENGTH_SHORT)
                }
            } else {
                withContext(Dispatchers.Main) {
                    callback.showToast("Failed to delete: ${parseError(response)}", Toast.LENGTH_LONG)
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                callback.showToast("Error deleting message: ${e.message}", Toast.LENGTH_LONG)
            }
        }
    }

    suspend fun confirmEditMessageOnServer(messageToEdit: ChatMessage, newText: String) {
        val messageId = messageToEdit.id ?: return withContext(Dispatchers.Main) {
            callback.showToast("Error: Message ID missing for editing.", Toast.LENGTH_SHORT)
        }

        val trimmedText = newText.trim()
        if (trimmedText.isBlank()) {
            return withContext(Dispatchers.Main) {
                callback.showToast("Message cannot be empty.", Toast.LENGTH_SHORT)
            }
        }

        try {
            val response = ApiClient.apiService.editMessage(
                messageId,
                mapOf("text" to trimmedText),
                "Bearer $token"
            )

            if (response.isSuccessful && response.body() != null) {
                val editedMessage = response.body()!!
                withContext(Dispatchers.Main) {
                    val updatedList = callback.getCurrentMessageList().map { current ->
                        if (current.id == messageId) editedMessage else current
                    }
                    callback.updateMessages(updatedList)
                    callback.showToast("Message updated", Toast.LENGTH_SHORT)
                }
            } else {
                withContext(Dispatchers.Main) {
                    callback.showToast("Failed to edit: ${parseError(response)}", Toast.LENGTH_LONG)
                }
            }
        } catch (e: Exception) {
            withContext(Dispatchers.Main) {
                callback.showToast("Error editing message: ${e.message}", Toast.LENGTH_LONG)
            }
        }
    }

    override fun onReplyToMessage(message: ChatMessage) =
        callback.requestReplyToMessage(message)

    override fun onForwardMessage(message: ChatMessage) =
        callback.showToast("Forward: ${message.text ?: "Media Message"}.", Toast.LENGTH_SHORT)

    override fun onEditMessage(message: ChatMessage, positionInAdapter: Int) =
        callback.requestEditMessage(message, positionInAdapter)

    override fun onPinMessage(message: ChatMessage, positionInAdapter: Int) =
        callback.showToast("Pin feature coming soon.", Toast.LENGTH_SHORT)

    override fun onReact(message: ChatMessage, reactionEmoji: String, positionInAdapter: Int) =
        callback.showToast("Reacted with $reactionEmoji", Toast.LENGTH_SHORT)

    override fun onReactWithImage(message: ChatMessage, positionInAdapter: Int) =
        callback.showToast("React with image feature coming soon.", Toast.LENGTH_SHORT)

    override fun onMarkMessage(message: ChatMessage, positionInAdapter: Int) =
        callback.showToast("Mark feature coming soon.", Toast.LENGTH_SHORT)

    override fun onShowMessageInfo(message: ChatMessage) =
        callback.showToast("Message info feature coming soon.", Toast.LENGTH_SHORT)

    // --- Other Helper Methods ---
    fun sendCurrentLocation() {
        if (callback.checkAndRequestPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            try {
                fusedLocationProviderClient.lastLocation.addOnSuccessListener { location: Location? ->
                    location?.let {
                        callback.requestSendChatMessage(
                            mapOf("location" to mapOf("latitude" to it.latitude, "longitude" to it.longitude))
                        )
                    } ?: callback.showToast("Location unavailable.", Toast.LENGTH_LONG)
                }.addOnFailureListener { e ->
                    callback.showToast("Failed to get location: ${e.message}", Toast.LENGTH_SHORT)
                }
            } catch (se: SecurityException) {
                callback.showToast("Location permission error.", Toast.LENGTH_LONG)
            }
        }
    }

    fun handleContactPickerResult(uri: Uri, contentResolver: android.content.ContentResolver) {
        val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
        cursor?.use {
            if (it.moveToFirst()) {
                val nameIndex = it.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
                val contactName = if (nameIndex != -1) it.getString(nameIndex) else "Unknown Contact"
                callback.requestSendChatMessage(mapOf("contactInfo" to contactName))
            }
        }
    }

    fun handlePermissionsResult(permissions: Map<String, Boolean>) {
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == false)
            callback.showToast("Location permission denied.", Toast.LENGTH_LONG)
        if (permissions[Manifest.permission.RECORD_AUDIO] == false)
            callback.showToast("Audio recording permission denied.", Toast.LENGTH_SHORT)
    }
// Add this new function inside your ChatActivityHelper class
fun cleanup() {
    try {
        // Stop message fetching safely
        stopFetchingMessages()

        // Remove any UI callbacks
        uiHandler.removeCallbacksAndMessages(null)

        Log.d("ChatActivityHelper", "✅ ChatActivityHelper cleaned up successfully")
    } catch (e: Exception) {
        Log.e("ChatActivityHelper", "⚠️ Error during cleanup: ${e.message}")
    }
}


    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string() ?: "Unknown error"
        } catch (e: IOException) {
            "Error parsing server response"
        }
    }
}
