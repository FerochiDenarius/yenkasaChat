package xyz.yenkasa.app.ui

import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log // Ensure Log is imported
import android.webkit.MimeTypeMap
import com.cloudinary.android.MediaManager
import com.cloudinary.android.callback.ErrorInfo
import com.cloudinary.android.callback.UploadCallback
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChatMessageHandler(
    private val context: Context,
    private val callback: ChatMessageCallback,
    private val token: String, // Keep if needed for other parts, though not for postMessage
    private val senderId: String,
    private val roomId: String
) {

    interface ChatMessageCallback {
        fun onMessageSent(message: ChatMessage)
        fun onError(error: String)
        fun onSendRejected(code: Int, reason: String?, message: String) {
            onError(message)
        }
        fun onUploadStarted(type: String) {}
    }

    private val apiService: ApiService = ApiClient.apiService

    fun sendMessage(data: Map<String, Any?>) {
        val messageMap = mutableMapOf<String, Any?>()

        // Always include sender & room
        messageMap["senderId"] = senderId
        messageMap["roomId"] = roomId

        // Handle text & contact info
        val text = data["text"] as? String
        val contactInfo = data["contactInfo"] as? String
        messageMap["text"] = contactInfo?.let { "📇 Contact: $it" } ?: text
        messageMap["contactInfo"] = contactInfo

        // Handle media (image, audio, video, file)
        messageMap["imageUrl"] = data["imageUrl"]
        messageMap["audioUrl"] = data["audioUrl"]
        messageMap["videoUrl"] = data["videoUrl"]
        messageMap["fileUrl"] = data["fileUrl"]

        // ✅ FIX: Add repliedTo if present
        val repliedTo = data["repliedTo"]
        if (repliedTo != null) {
            messageMap["repliedTo"] = repliedTo
            Log.d("ChatMessageHandler", "📌 Attached repliedTo message ID: $repliedTo")
        } else {
            Log.d("ChatMessageHandler", "No repliedTo attached")
        }


        // ✅ Always include OneSignal Player ID
        val playerId = com.onesignal.OneSignal.getDeviceState()?.userId
        if (!playerId.isNullOrBlank()) {
            messageMap["playerId"] = playerId
            Log.d("ChatMessageHandler", "Attached OneSignal playerId: $playerId")
        } else {
            Log.w("ChatMessageHandler", "No playerId found from OneSignal device state")
        }

        // Handle location if provided
        if (data["location"] is Map<*, *>) {
            val loc = data["location"] as Map<*, *>
            val lat = loc["latitude"] as? Double
            val lon = loc["longitude"] as? Double
            if (lat != null && lon != null) {
                messageMap["location"] = mapOf("latitude" to lat, "longitude" to lon)
            }
        }
        // Log the final message payload before sending showing if playerId is included
        Log.d("ChatMessageHandler", "📤 Final message payload being sent: $messageMap")
        // Send to backend
        postMessage(messageMap)
    }

// Replace your old uploadFileToCloudinary function with this one

    fun uploadFileToCloudinary(
        uri: Uri,
        type: String,
        extraMessageData: Map<String, Any?> = emptyMap()
    ) {
        Log.d("ChatMessageHandler", "Preparing to upload $type file. Original URI: $uri")

        // 1. ✅ THIS IS THE FIX: Copy the file to a safe local directory first.
        val safeUri = copyFileToCacheDir(uri, type)

        // 2. ✅ Only proceed if the copy was successful.
        if (safeUri == null) {
            Log.e("ChatMessageHandler", "Upload cancelled because file copy failed.")
            return // Stop the function here
        }

        Log.d("ChatMessageHandler", "File copied successfully. Safe URI for upload: $safeUri")

        // 3. ✅ Use the 'safeUri' for the upload, NOT the original 'uri'.
        MediaManager.get().upload(safeUri)
            .option("resource_type", if (type == "audio" || type == "video") "video" else "auto")
            .callback(object : UploadCallback {
                override fun onStart(requestId: String?) {
                    Log.d("ChatMessageHandler", "Cloudinary upload started. Request ID: $requestId, Type: $type")
                    callback.onUploadStarted(type)
                }

                override fun onProgress(requestId: String?, bytes: Long, totalBytes: Long) {
                    // Optional: Log progress if needed
                }

                override fun onSuccess(requestId: String?, resultData: MutableMap<Any?, Any?>?) {
                    Log.d("ChatMessageHandler", "Cloudinary upload success. Result: $resultData")
                    val secureUrl = resultData?.get("secure_url") as? String
                    if (!secureUrl.isNullOrBlank()) {
                        Log.i("ChatMessageHandler", "Secure URL extracted: $secureUrl. Proceeding to send message.")
                        val mediaKey = when (type) {
                            "image" -> "imageUrl"
                            "audio" -> "audioUrl"
                            "video" -> "videoUrl"
                            "file" -> "fileUrl"
                            else -> "fileUrl"
                        }
                        sendMessage(extraMessageData + mapOf(mediaKey to secureUrl))
                    } else {
                        Log.e("ChatMessageHandler", "Cloudinary upload succeeded but secure_url is null or blank.")
                        callback.onError("Upload succeeded but no URL was returned.")
                    }
                }

                override fun onError(requestId: String?, error: ErrorInfo?) {
                    Log.e("ChatMessageHandler", "Cloudinary upload failed. Error: ${error?.description}")
                    callback.onError("Upload failed: ${error?.description} (Code: ${error?.code})")
                }

                override fun onReschedule(requestId: String?, error: ErrorInfo?) {
                    Log.w("ChatMessageHandler", "Cloudinary upload rescheduled. Error: ${error?.description}")
                    callback.onError("Upload rescheduled: ${error?.description}")
                }
            }).dispatch()
    }

    fun checkAndUploadAudio(uri: Uri) {
        uploadFileToCloudinary(uri, "audio")
    }
// Add this new private function inside your ChatMessageHandler class

    private fun copyFileToCacheDir(fileUri: Uri, type: String): Uri? {
        return try {
            val inputStream = context.contentResolver.openInputStream(fileUri) ?: return null
            val fileName = "upload_${System.currentTimeMillis()}${resolveUploadExtension(fileUri, type)}"
            val outputFile = java.io.File(context.cacheDir, fileName)
            val outputStream = java.io.FileOutputStream(outputFile)

            inputStream.use { input ->
                outputStream.use { output ->
                    input.copyTo(output)
                }
            }
            Uri.fromFile(outputFile)
        } catch (e: Exception) {
            Log.e("ChatMessageHandler", "Failed to copy file from URI: $fileUri", e)
            callback.onError("Failed to process the selected file.")
            null
        }
    }

    private fun resolveUploadExtension(fileUri: Uri, type: String): String {
        val displayName = queryDisplayName(fileUri)
        val displayExtension = displayName
            ?.substringAfterLast('.', missingDelimiterValue = "")
            ?.takeIf { it.isNotBlank() && it.length <= 8 }
        if (!displayExtension.isNullOrBlank()) return ".$displayExtension"

        val mimeType = context.contentResolver.getType(fileUri)
        val mimeExtension = mimeType
            ?.let { MimeTypeMap.getSingleton().getExtensionFromMimeType(it) }
            ?.takeIf { it.isNotBlank() }
        if (!mimeExtension.isNullOrBlank()) return ".$mimeExtension"

        return when (type) {
            "image" -> ".jpg"
            "audio" -> ".m4a"
            "video" -> ".mp4"
            else -> ""
        }
    }

    private fun queryDisplayName(fileUri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = context.contentResolver.query(fileUri, null, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) cursor.getString(nameIndex) else null
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w("ChatMessageHandler", "Could not resolve display name for $fileUri", e)
            null
        } finally {
            cursor?.close()
        }
    }

    private fun postMessage(messageMap: Map<String, Any?>) {
        Log.d("ChatMessageHandler", "Posting message to backend: $messageMap") // Log message being sent
        val call = apiService.sendMessage(messageMap)
        call.enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful && response.body() != null) {
                    val sentMessage = response.body()!!
                    Log.i("ChatMessageHandler", "Message sent successfully to backend. Response: $sentMessage")
                    callback.onMessageSent(sentMessage)
                } else {
                    val errorBodyString = response.errorBody()?.string() ?: "Unknown error"
                    Log.e("ChatMessageHandler", "Send message to backend failed. Code: ${response.code()}, ErrorBody: $errorBodyString, Message: ${response.message()}")
                    callback.onSendRejected(
                        response.code(),
                        parseErrorReason(errorBodyString),
                        friendlySendError(response.code(), errorBodyString)
                    )
                }
            }


            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Log.e("ChatMessageHandler", "Send message to backend error (network/other). Message: ${t.message}", t)
                callback.onError("Send error: ${t.message}")
            }
        })
    }

    private fun parseErrorReason(errorBody: String): String? {
        return runCatching { JSONObject(errorBody).optString("reason").ifBlank { null } }.getOrNull()
    }

    private fun friendlySendError(code: Int, errorBody: String): String {
        val json = runCatching { JSONObject(errorBody) }.getOrNull()
        val reason = json?.optString("reason").orEmpty()
        val serverMessage = json?.optString("error").orEmpty()
            .ifBlank { json?.optString("message").orEmpty() }

        return when {
            code == 423 && reason == "requires_approval" ->
                "This person requires approval before you can message them."
            code == 423 && reason == "not_accepting" ->
                "This person is not accepting messages right now."
            code == 403 && reason == "blocked" ->
                "You cannot message this person because of privacy settings."
            serverMessage.isNotBlank() -> serverMessage
            else -> "Message could not be sent. Please try again."
        }
    }
}
