package com.example.yenkasachat.ui

import android.content.Context
import android.net.Uri
import android.util.Log
import com.cloudinary.android.MediaManager
import com.cloudinary.android.callback.ErrorInfo
import com.cloudinary.android.callback.UploadCallback
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.LocationData
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.ApiService
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChatMessageHandler(
    private val context: Context,
    private val callback: ChatMessageCallback,
    private val token: String,
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

        messageMap["senderId"] = senderId
        messageMap["roomId"] = roomId

        val text = data["text"] as? String
        val contactInfo = data["contactInfo"] as? String

        messageMap["text"] = contactInfo?.let { "📇 Contact: $it" } ?: text
        messageMap["imageUrl"] = data["imageUrl"]
        messageMap["audioUrl"] = data["audioUrl"]
        messageMap["videoUrl"] = data["videoUrl"]
        messageMap["fileUrl"] = data["fileUrl"]
        messageMap["contactInfo"] = contactInfo

        if (data["location"] is Map<*, *>) {
            val loc = data["location"] as Map<*, *>
            val lat = loc["latitude"] as? Double
            val lon = loc["longitude"] as? Double
            if (lat != null && lon != null) {
                messageMap["location"] = mapOf("latitude" to lat, "longitude" to lon)
            }
        }

        postMessage(messageMap)
    }

    fun uploadFileToCloudinary(uri: Uri, type: String) {
        MediaManager.get().upload(uri)
            .callback(object : UploadCallback {
                override fun onStart(requestId: String?) {}
                override fun onProgress(requestId: String?, bytes: Long, totalBytes: Long) {}
                override fun onSuccess(requestId: String?, resultData: MutableMap<Any?, Any?>?) {
                    val secureUrl = resultData?.get("secure_url") as? String
                    if (!secureUrl.isNullOrBlank()) {
                        val mediaKey = when (type) {
                            "image" -> "imageUrl"
                            "audio" -> "audioUrl"
                            "video" -> "videoUrl"
                            "file" -> "fileUrl"
                            else -> "fileUrl"
                        }
                        sendMessage(mapOf(mediaKey to secureUrl))
                    } else {
                        callback.onError("Upload succeeded but no URL returned")
                    }
                }

                override fun onError(requestId: String?, error: ErrorInfo?) {
                    callback.onError("Upload failed: ${error?.description}")
                }

                override fun onReschedule(requestId: String?, error: ErrorInfo?) {
                    callback.onError("Upload rescheduled: ${error?.description}")
                }
            })
    }

    fun checkAndUploadAudio(uri: Uri) {
        uploadFileToCloudinary(uri, "audio")
    }

    private fun postMessage(messageMap: Map<String, Any?>) {
        val call = apiService.sendMessage(token, messageMap)
        call.enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful && response.body() != null) {
                    val sentMessage = response.body()!!
                    callback.onMessageSent(sentMessage)

                    val playerId = "TODO" // Replace if your message has recipient.playerId
                    val senderName = "Someone" // Replace with real sender name if needed

                    val messageText = when {
                        !sentMessage.text.isNullOrBlank() -> sentMessage.text
                        !sentMessage.imageUrl.isNullOrBlank() ||
                                !sentMessage.audioUrl.isNullOrBlank() ||
                                !sentMessage.videoUrl.isNullOrBlank() ||
                                !sentMessage.fileUrl.isNullOrBlank() -> "📎 Media"
                        sentMessage.location != null -> "📍 Location"
                        else -> "You have a new message"
                    }

                    if (playerId != "TODO") {
                        OneSignalNotificationSender.sendNotification(
                            receiverPlayerId = playerId,
                            title = "New message from $senderName",
                            message = messageText
                        )
                    }

                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                    Log.e("ChatMessageHandler", "Send failed: $errorMsg")
                    callback.onError("Message send failed")
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Log.e("ChatMessageHandler", "Send error: ${t.message}")
                callback.onError("Send error: ${t.message}")
            }
        })
    }
}
