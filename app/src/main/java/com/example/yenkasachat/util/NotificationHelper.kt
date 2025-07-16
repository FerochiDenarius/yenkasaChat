package com.example.yenkasachat.util

import android.app.*
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.example.yenkasachat.R
import com.example.yenkasachat.ui.ChatActivity
import com.example.yenkasachat.ui.MainActivity

object NotificationHelper {

    private const val CHANNEL_ID = "yenkasachat_messages"
    private const val CHANNEL_NAME = "Chat Messages"

    fun showMessageNotification(
        context: Context,
        senderName: String,
        message: String,
        chatId: String? = null
    ) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w("NotificationHelper", "🔕 Notifications are disabled by user/system")
            return
        }

        createNotificationChannel(context)

        val notificationSound = try {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        } catch (e: SecurityException) {
            Log.e("NotificationHelper", "❌ Failed to access notification sound: ${e.message}")
            null
        }

        // ✅ Tap intent: go to ChatActivity if chatId is given, else MainActivity
        val intent = if (!chatId.isNullOrEmpty()) {
            Intent(context, ChatActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                putExtra("roomId", chatId)
            }
        } else {
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_message) // Ensure this icon exists and is a white vector
            .setContentTitle("New message from $senderName")
            .setContentText(message.take(120))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(Color.parseColor("#128C7E"))
            .setContentIntent(pendingIntent)

        if (notificationSound != null) {
            builder.setSound(notificationSound)
        }

        NotificationManagerCompat.from(context)
            .notify(System.currentTimeMillis().toInt(), builder.build())
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = try {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            } catch (e: SecurityException) {
                Log.e("NotificationHelper", "❌ Failed to access notification sound: ${e.message}")
                null
            }

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for new chat messages"
                enableLights(true)
                lightColor = Color.BLUE
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PRIVATE
                if (soundUri != null) {
                    setSound(soundUri, audioAttributes)
                }
            }

            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
