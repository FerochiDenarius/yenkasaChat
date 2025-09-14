package com.example.yenkasachat.ui

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import android.content.pm.PackageManager
import android.database.Cursor
import android.location.Location
import android.net.Uri
import android.os.Handler
import android.provider.ContactsContract
import android.util.Log
import android.widget.Toast
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.NotificationHelper
// Ensure this import is correct and OnMessageActionListener is in its own file
import com.example.yenkasachat.ui.OnMessageActionListener
import com.google.android.gms.location.FusedLocationProviderClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

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

    // New callback method for delete confirmation
    fun requestDeleteConfirmation(messageToDelete: ChatMessage)
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
    private val fusedLocationClient: FusedLocationProviderClient,
    private val uiHandler: Handler
) : OnMessageActionListener { // ChatActivityHelper implements this

    private var lastMessageTimestamp: Long = 0L
    private val refreshInterval = 5000L
    private var isFetchingActive = false

    // --- Message Fetching ---
    fun startFetchingMessagesRepeatedly() {
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
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                if (isFetchingActive) {
                    fetchMessagesRepeatedlyInternal()
                }
            }
        }, refreshInterval)
    }

    private fun fetchMessages() {
        if (roomId.isBlank()) {
            Log.e("HelperFetchMessages", "Room ID is blank.")
            return
        }
        ApiClient.apiService.getMessages(roomId = this.roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    if (!isFetchingActive) return

                    if (response.isSuccessful) {
                        val messages = response.body() // This is List<ChatMessage>?
                        if (messages != null) {
                            // Assuming 'timestamp' in ChatMessage is a String that can be converted to Long
                            val newMessages = messages.filter {
                                (it.timestamp?.toLongOrNull() ?: 0L) > lastMessageTimestamp
                            }

                            if (newMessages.isNotEmpty()) {
                                newMessages.forEach { msg ->
                                    // Use the new 'actualSenderId' and 'actualSenderUsername'
                                    if (msg.actualSenderId != senderId) { // Check if the message is from someone else
                                        NotificationHelper.showMessageNotification(
                                            context,
                                            // Prefer username from the nested sender object, fallback if needed
                                            msg.actualSenderUsername ?: "Someone",
                                            msg.text ?: msg.imageUrl ?: msg.fileUrl ?: msg.contactInfo ?: "New message"
                                        )
                                    }
                                }
                                newMessages.lastOrNull()?.let { lastNewMsg ->
                                    lastMessageTimestamp = lastNewMsg.timestamp?.toLongOrNull() ?: lastMessageTimestamp
                                }
                            }
                            callback.updateMessages(messages.toList())
                        } else {
                            Log.d("HelperFetchMessages", "Response successful but message list is null.")
                        }
                    }
else {
                        val errorMsg = parseError(response)
                        Log.e("HelperFetchMessages", "Failed to fetch messages: $errorMsg (Code: ${response.code()})")
                    }
                }

                override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                    if (!isFetchingActive) return
                    Log.e("HelperFetchMessages", "Error fetching messages: ${t.message}", t)
                    callback.showToast("Couldn't refresh messages: ${t.message}", Toast.LENGTH_SHORT)
                }
            })
    }

    fun onMessageSentByHandler(message: ChatMessage) {
        val currentMessages = callback.getCurrentMessageList().toMutableList()
        if (!currentMessages.any { msg -> message.messageId != null && msg.messageId == message.messageId }) {
            currentMessages.add(message)
            callback.updateMessages(currentMessages.toList())
            val messageTs = message.timestamp?.toLongOrNull() ?: 0L
            if (messageTs > lastMessageTimestamp) {
                lastMessageTimestamp = messageTs
            }
        }
    }

    fun onErrorFromHandler(error: String) {
        if (!isFetchingActive && !error.contains("Network request timed out", ignoreCase = true)) return
        callback.showToast("Error: $error", Toast.LENGTH_LONG)
        Log.e("ChatActivityHelper", "ChatMessageHandler Error: $error")
    }

    // --- OnMessageActionListener Implementations ---
    override fun onCopyText(message: ChatMessage) {
        if (!message.text.isNullOrBlank()) {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("messageText", message.text)
            clipboard.setPrimaryClip(clip)
            callback.showToast("Message copied", Toast.LENGTH_SHORT)
        }
    }

    override fun onDeleteMessage(message: ChatMessage, positionInAdapter: Int) {
        // Use the new 'actualSenderId' convenience getter
        if (message.actualSenderId != senderId) {
            callback.showToast("You can only delete your own messages.", Toast.LENGTH_SHORT)
            return
        }
        if (message.messageId == null) {
            callback.showToast("Cannot delete: message has no ID.", Toast.LENGTH_SHORT)
            Log.e("ChatActivityHelper", "Attempted to delete message without an ID: ${message.text}")
            return
        }
        // Request confirmation from the Activity
        callback.requestDeleteConfirmation(message)
    }


    // New method called by ChatActivity after user confirms deletion

    suspend fun confirmDeleteMessageOnServer(messageToDelete: ChatMessage) {
        if (messageToDelete.messageId == null) {
            Log.e("ChatActivityHelper", "confirmDeleteMessageOnServer called with null messageId.")
            // Ensure UI updates are on the main thread
            withContext(Dispatchers.Main) {
                callback.showToast("Error: Message ID missing for deletion.", Toast.LENGTH_SHORT)
            }
            return
        }

        Log.d("ChatActivityHelper", "Proceeding to delete messageId on server: ${messageToDelete.messageId}")

        try {
            // THE KEY CHANGE IS HERE:
            // 1. Direct call to the suspend function.
            // 2. Pass ALL required parameters (including authToken).
            // 3. No .enqueue()
            val response = ApiClient.apiService.deleteMessage(
                authToken = "Bearer $token", // Make sure 'token' is accessible and correct
                messageId = messageToDelete.messageId!!
            )

            if (response.isSuccessful) {
                withContext(Dispatchers.Main) {
                    callback.showToast("Message deleted", Toast.LENGTH_SHORT)
                    Log.d("ChatActivityHelper", "Message ${messageToDelete.messageId} deleted successfully from server.")

                    val currentMessages = callback.getCurrentMessageList().toMutableList()
                    val removed = currentMessages.removeAll { it.messageId == messageToDelete.messageId }
                    if (removed) {
                        callback.updateMessages(currentMessages.toList())
                    } else {
                        Log.w("ChatActivityHelper", "Message ${messageToDelete.messageId} not found in current list after delete. Fetching fresh.")
                        // If fetchMessages is still using .enqueue(), it can be called directly.
                        // If fetchMessages is also a suspend function, you'd call it directly:
                        // fetchMessages()
                        fetchMessages() // Assuming this is still the old enqueue version for now or also converted
                    }
                }
            } else {
                val errorMsg = parseError(response) // Ensure parseError handles Response<*>
                withContext(Dispatchers.Main) {
                    callback.showToast("Failed to delete message: $errorMsg", Toast.LENGTH_LONG)
                    Log.e("ChatActivityHelper", "Failed to delete message ${messageToDelete.messageId}: $errorMsg (Code: ${response.code()})")
                }
            }
        } catch (e: Exception) { // Catch network errors or other exceptions
            Log.e("ChatActivityHelper", "Error deleting message ${messageToDelete.messageId}", e)
            withContext(Dispatchers.Main) {
                callback.showToast("Error deleting message: ${e.message}", Toast.LENGTH_LONG)
            }
        }
    }

    override fun onReplyToMessage(message: ChatMessage) {
        callback.showToast("Reply to: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: callback.requestSetupReplyUI(message)
    }

    override fun onForwardMessage(message: ChatMessage) {
        callback.showToast("Forward: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: callback.requestNavigateToForwardScreen(message)
    }

    override fun onEditMessage(message: ChatMessage, positionInAdapter: Int) {
        // Use the new 'actualSenderId' convenience getter
        if (message.actualSenderId == senderId && !message.text.isNullOrBlank()) {
            callback.showToast("Edit: ${message.text}. Logic pending.", Toast.LENGTH_SHORT)
            // Future: callback.requestShowEditMessageDialog(message)
        } else {
            callback.showToast("Cannot edit this message.", Toast.LENGTH_SHORT)
        }
    }


    override fun onPinMessage(message: ChatMessage, positionInAdapter: Int) {
        callback.showToast("Pin/Unpin: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: API call to pin/unpin, then update UI. May need a field in ChatMessage.
    }

    override fun onReact(message: ChatMessage, reactionEmoji: String, positionInAdapter: Int) {
        callback.showToast("React with $reactionEmoji to: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: API call to add reaction, then update specific message in UI.
    }

    override fun onReactWithImage(message: ChatMessage, positionInAdapter: Int) {
        callback.showToast("React with image to: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: similar to onReact, but might involve image selection/upload.
    }

    override fun onMarkMessage(message: ChatMessage, positionInAdapter: Int) {
        callback.showToast("Mark: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: could be for starring/bookmarking. API call, then UI update.
    }

    override fun onShowMessageInfo(message: ChatMessage) {
        callback.showToast("Info for: ${message.text ?: "Media Message"}. Logic pending.", Toast.LENGTH_SHORT)
        // Future: callback.requestShowMessageInfoScreen(message)
    }


    // --- Other Helper Methods ---
    fun sendCurrentLocation() {
        if (callback.checkAndRequestPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            try {
                fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                    location?.let {
                        callback.requestSendChatMessage(
                            mapOf("location" to mapOf("latitude" to it.latitude, "longitude" to it.longitude))
                        )
                    } ?: callback.showToast("Could not get current location. Ensure location services are enabled.", Toast.LENGTH_LONG)
                }.addOnFailureListener { e ->
                    Log.e("ChatActivityHelper", "Failed to get location", e)
                    callback.showToast("Failed to get location: ${e.message}", Toast.LENGTH_SHORT)
                }
            } catch (se: SecurityException) {
                Log.e("ChatActivityHelper", "Location permission missing despite check.", se)
                callback.showToast("Location permission error. Please grant permission.", Toast.LENGTH_LONG)
            }
        } else {
            // Toast is handled by ChatActivity or permission request flow
        }
    }

    fun handleContactPickerResult(uri: Uri, contentResolver: android.content.ContentResolver) {
        val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
        cursor?.use { cur ->
            if (cur.moveToFirst()) {
                val nameIndex = cur.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
                val name = if (nameIndex != -1) cur.getString(nameIndex) else "Unknown Contact"
                callback.requestSendChatMessage(mapOf("contactInfo" to name))
            }
        }
    }

    fun handlePermissionsResult(permissions: Map<String, Boolean>) {
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == false) {
            callback.showToast("Location permission denied. Sharing location is disabled.", Toast.LENGTH_LONG)
        }
        if (permissions[Manifest.permission.RECORD_AUDIO] == false) {
            callback.showToast("Audio recording permission denied.", Toast.LENGTH_LONG)
        }
        if (permissions[Manifest.permission.CAMERA] == false) {
            callback.showToast("Camera permission denied.", Toast.LENGTH_LONG)
        }
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string() ?: "Unknown error (empty error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
