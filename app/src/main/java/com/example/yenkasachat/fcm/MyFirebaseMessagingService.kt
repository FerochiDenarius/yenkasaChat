package com.example.yenkasachat.fcm

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.example.yenkasachat.R
import com.example.yenkasachat.ui.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        // Extract title and body from data or notification payload
        val title = remoteMessage.data["title"] ?: remoteMessage.notification?.title ?: "YenkasaChat"
        val message = remoteMessage.data["body"] ?: remoteMessage.notification?.body ?: "You have a new message"

        // Optional: Get custom data like chatId
        val chatId = remoteMessage.data["chatId"]

        showNotification(title, message, chatId)
    }

    private fun showNotification(title: String, message: String, chatId: String?) {
        val channelId = "yenkasachat_fcm_channel"
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel for Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "YenkasaChat Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "YenkasaChat message alerts"
                enableLights(true)
                lightColor = Color.BLUE
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Intent to launch MainActivity or ChatActivity
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            chatId?.let {
                putExtra("chatId", it)
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notificationSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.drawable.ic_message) // Ensure this icon exists
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setSound(notificationSound)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        // Use unique ID to avoid overwriting notifications
        val notificationId = System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, builder.build())
    }
}
