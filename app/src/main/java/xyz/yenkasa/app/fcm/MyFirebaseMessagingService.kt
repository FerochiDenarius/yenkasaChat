package xyz.yenkasa.app.fcm

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import xyz.yenkasa.app.util.ChatNotificationState
import xyz.yenkasa.app.util.NotificationHelper

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        Log.d("FCM", "📨 Firebase Message received: $remoteMessage")

        // You will only reach here if FCM sends a direct message (not through OneSignal)
        if (remoteMessage.data.isEmpty()) {
            Log.w("FCM", "⚠️ Empty payload — likely not from your backend.")
            return
        }

        val senderName = remoteMessage.data["title"] ?: "YenkasaChat"
        val text = remoteMessage.data["text"] ?: ""
        val type = remoteMessage.data["type"] ?: "text"
        val chatId = remoteMessage.data["chatId"] ?: remoteMessage.data["roomId"]
        val senderId = remoteMessage.data["senderId"]
        val messageId = remoteMessage.data["messageId"]

        if (ChatNotificationState.shouldSuppressNotification(this, senderId, chatId, messageId)) {
            Log.d("FCM", "Chat notification suppressed: sender/current user, active room, or duplicate message.")
            return
        }

        val previewMessage = when (type.lowercase()) {
            "image" -> "📷 Photo"
            "audio" -> "🎵 Audio"
            "video" -> "🎬 Video"
            "file" -> "📄 File"
            "contact" -> "👤 Contact"
            "location" -> "📍 Location"
            else -> text.take(120)
        }

        NotificationHelper.showMessageNotification(
            context = this,
            senderName = senderName,
            message = previewMessage,
            chatId = chatId
        )
    }

    override fun onNewToken(token: String) {
        Log.d("FCM", "🆕 New Firebase token: $token")
        // Optional: Upload token to your backend if needed
    }
}
