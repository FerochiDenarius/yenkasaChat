package com.example.yenkasachat.ui

import android.content.Context
import android.net.Uri
import android.util.Log // Ensure Log is imported
import com.cloudinary.android.MediaManager
import com.cloudinary.android.callback.ErrorInfo
import com.cloudinary.android.callback.UploadCallback
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.ApiService
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

    fun uploadFileToCloudinary(uri: Uri, type: String) {
        Log.d("ChatMessageHandler", "Attempting to upload $type file. URI: $uri") // Added pre-upload log
        MediaManager.get().upload(uri)
            .option("resource_type", if (type == "audio" || type == "video") "video" else "auto") // Optional: Be specific for audio/video
            .callback(object : UploadCallback {
                override fun onStart(requestId: String?) {
                    // Log when the upload starts
                    Log.d("ChatMessageHandler", "Cloudinary upload started. Request ID: $requestId, Type: $type")
                }

                override fun onProgress(requestId: String?, bytes: Long, totalBytes: Long) {
                    // Optional: Log progress if needed, can be verbose
                    // Log.d("ChatMessageHandler", "Cloudinary upload progress. Request ID: $requestId, Bytes: $bytes/$totalBytes")
                }

                override fun onSuccess(requestId: String?, resultData: MutableMap<Any?, Any?>?) {
                    // Log the full result data from Cloudinary on success
                    Log.d("ChatMessageHandler", "Cloudinary upload success. Request ID: $requestId, Type: $type, Result: $resultData")

                    val secureUrl = resultData?.get("secure_url") as? String
                    if (!secureUrl.isNullOrBlank()) {
                        Log.i("ChatMessageHandler", "Secure URL extracted: $secureUrl. Proceeding to send message.")
                        val mediaKey = when (type) {
                            "image" -> "imageUrl"
                            "audio" -> "audioUrl"
                            "video" -> "videoUrl"
                            "file" -> "fileUrl"
                            else -> "fileUrl" // Default case
                        }
                        sendMessage(mapOf(mediaKey to secureUrl))
                    } else {
                        Log.e("ChatMessageHandler", "Cloudinary upload succeeded for Request ID: $requestId, Type: $type, but secure_url is null or blank. Result: $resultData")
                        callback.onError("Upload to Cloudinary succeeded but no URL was returned.")
                    }
                }

                override fun onError(requestId: String?, error: ErrorInfo?) {
                    // Log detailed error information from Cloudinary
                    Log.e("ChatMessageHandler", "Cloudinary upload failed. Request ID: $requestId, Type: $type, Error Code: ${error?.code}, Description: ${error?.description}, Full Error: $error")
                    callback.onError("Upload failed: ${error?.description} (Code: ${error?.code})")
                }

                override fun onReschedule(requestId: String?, error: ErrorInfo?) {
                    // Log if the upload is rescheduled
                    Log.w("ChatMessageHandler", "Cloudinary upload rescheduled. Request ID: $requestId, Type: $type, Error: ${error?.description}")
                    callback.onError("Upload rescheduled: ${error?.description}")
                }
            }).dispatch() // Don't forget to call dispatch() to start the upload
    }

    fun checkAndUploadAudio(uri: Uri) {
        uploadFileToCloudinary(uri, "audio")
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
                    callback.onError("Message send failed: $errorBodyString (Code: ${response.code()})")
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Log.e("ChatMessageHandler", "Send message to backend error (network/other). Message: ${t.message}", t)
                callback.onError("Send error: ${t.message}")
            }
        })
    }
}
