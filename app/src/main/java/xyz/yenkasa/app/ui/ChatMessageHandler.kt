package xyz.yenkasa.app.ui

import android.content.Context
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log // Ensure Log is imported
import android.webkit.MimeTypeMap
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import xyz.yenkasa.app.model.ChatMediaUploadResponse
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.ApiService
import xyz.yenkasa.app.util.UploadMediaOptimizer
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.util.Locale

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
        messageMap["messageType"] = data["messageType"]

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

    fun uploadFileToR2(
        uri: Uri,
        type: String,
        extraMessageData: Map<String, Any?> = emptyMap()
    ) {
        Log.d("ChatMessageHandler", "Preparing to upload $type file. Original URI: $uri")

        // 1. ✅ THIS IS THE FIX: Copy the file to a safe local directory first.
        val safeUri = prepareUploadUri(uri, type)

        // 2. ✅ Only proceed if the copy was successful.
        if (safeUri == null) {
            Log.e("ChatMessageHandler", "Upload cancelled because file copy failed.")
            return // Stop the function here
        }

        Log.d("ChatMessageHandler", "File copied successfully. Safe URI for upload: $safeUri")

        val uploadFile = safeUri.path?.let { path -> File(path) }
        if (uploadFile == null || !uploadFile.exists() || uploadFile.length() <= 0L) {
            Log.e("ChatMessageHandler", "Upload cancelled because prepared file is missing or empty: $safeUri")
            callback.onError("Failed to process the selected file.")
            return
        }

        val mimeType = resolveUploadMimeType(uri, type)
        val requestFile = uploadFile.asRequestBody(mimeType.toMediaTypeOrNull())
        val filePart = MultipartBody.Part.createFormData("file", uploadFile.name, requestFile)
        val typePart = type.toRequestBody("text/plain".toMediaTypeOrNull())

        callback.onUploadStarted(type)
        ApiClient.uploadApiService.uploadChatMedia(filePart, typePart)
            .enqueue(object : Callback<ChatMediaUploadResponse> {
                override fun onResponse(
                    call: Call<ChatMediaUploadResponse>,
                    response: Response<ChatMediaUploadResponse>
                ) {
                    val body = response.body()
                    if (response.isSuccessful && body?.url?.isNotBlank() == true) {
                        val mediaKey = body.messageKey?.takeIf { it.isNotBlank() } ?: when (type) {
                            "image" -> "imageUrl"
                            "audio" -> "audioUrl"
                            "video" -> "videoUrl"
                            else -> "fileUrl"
                        }
                        Log.i("ChatMessageHandler", "Chat media uploaded to R2. key=$mediaKey type=${body.type}")
                        sendMessage(extraMessageData + mapOf(mediaKey to body.url))
                    } else {
                        val errorBodyString = response.errorBody()?.string().orEmpty()
                        Log.e(
                            "ChatMessageHandler",
                            "R2 chat media upload failed. Code: ${response.code()}, ErrorBody: $errorBodyString"
                        )
                        callback.onError(parseUploadError(errorBodyString))
                    }
                }

                override fun onFailure(call: Call<ChatMediaUploadResponse>, t: Throwable) {
                    Log.e("ChatMessageHandler", "R2 chat media upload failed: ${t.message}", t)
                    callback.onError("Upload failed: ${t.message}")
                }
            })
    }

    fun checkAndUploadAudio(uri: Uri) {
        uploadFileToR2(uri, "audio")
    }

    private fun prepareUploadUri(fileUri: Uri, type: String): Uri? {
        val optimized = UploadMediaOptimizer.prepareForUpload(
            context = context,
            uri = fileUri,
            type = type,
            maxImageDimension = 1280,
            jpegQuality = 82
        )
        if (optimized != null) return Uri.fromFile(optimized)
        return copyFileToCacheDir(fileUri, type)
    }

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

    private fun resolveUploadMimeType(fileUri: Uri, type: String): String {
        return context.contentResolver.getType(fileUri) ?: when (type) {
            "image" -> "image/jpeg"
            "audio" -> "audio/mp4"
            "video" -> "video/mp4"
            else -> "application/octet-stream"
        }
    }

    private fun parseUploadError(errorBody: String): String {
        return runCatching {
            val json = JSONObject(errorBody)
            json.optString("error").ifBlank { json.optString("message") }
        }.getOrNull()?.takeIf { it.isNotBlank() } ?: "Upload failed. Please try again."
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
        val lowerMessage = serverMessage.lowercase(Locale.US)

        return when {
            code == 423 && reason == "requires_approval" ->
                "This person requires approval before you can message them."
            code == 423 && reason == "not_accepting" ->
                "This person is not accepting messages right now."
            code == 423 && reason == "not_community_member" ->
                "Only people who share a community with this person can message them."
            code == 403 && reason == "blocked_by_user" ->
                "You can’t send this message because this user has blocked you."
            code == 403 && reason == "you_blocked_user" ->
                "You blocked this user. Unblock them before messaging."
            reason.contains("blocked", ignoreCase = true) || lowerMessage.contains("blocked") ->
                serverMessage.ifBlank { "You can’t send this message because messaging is blocked." }
            serverMessage.isNotBlank() -> serverMessage
            else -> "Message could not be sent. Please try again."
        }
    }
}
