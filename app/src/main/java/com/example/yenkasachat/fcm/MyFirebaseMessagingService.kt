package com.example.yenkasachat.fcm

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.example.yenkasachat.util.NotificationHelper

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d("FCM", "Message received: $remoteMessage")

        val data = remoteMessage.data
        if (data.isEmpty()) {
            Log.w("FCM", "⚠️ Received empty data payload, skipping.")
            return
        }

        val senderName = data["title"] ?: "YenkasaChat"
        val text = data["text"] ?: ""
        val type = data["type"] ?: "text"
        val chatId = data["chatId"]

        val previewMessage = when (type.lowercase()) {
            "image" -> "📷 Photo"
            "audio" -> "🎵 Audio"
            "video" -> "🎬 Video"
            "file" -> "📄 File"
            "contact" -> "👤 Contact"
            "location" -> "📍 Location"
            else -> text.take(120)
        }

        // ✅ Send notification using centralized helper
        NotificationHelper.showMessageNotification(
            context = this,
            senderName = senderName,
            message = previewMessage,
            chatId = chatId
        )
    }
}
