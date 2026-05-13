package xyz.yenkasa.app.util

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R
import xyz.yenkasa.app.ui.ChatActivity
import xyz.yenkasa.app.ui.IncomingCallActivity
import xyz.yenkasa.app.ui.MainActivity

object NotificationHelper {

    private const val CALL_CHANNEL_ID = "yenkasachat_calls"
    private const val CALL_NOTIFICATION_ID = 9999
    private const val PREFS_NAME = "settings"
    private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"

    private fun hasPostNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else true
    }

    // -------------------------------------------------------------------------
    // 📞 INCOMING CALL
    // -------------------------------------------------------------------------
    fun showIncomingCallNotification(
        context: Context,
        callerName: String,
        isVideo: Boolean,
        roomUrl: String?,
        token: String?,
        callerId: String?
    ) {
        if (!hasPostNotificationPermission(context)) {
            Log.w("NotificationHelper", "Notification permission denied; skipping call notification.")
            return
        }

        createCallChannel(context)

        val callType = if (isVideo) "Video Call" else "Audio Call"
        val soundUri = try {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        } catch (e: SecurityException) {
            Log.w("NotificationHelper", "Ringtone permission denied: ${e.message}")
            null
        }

        val acceptIntent = Intent(context, IncomingCallActivity::class.java).apply {
            putExtra("CALLER_ID", callerId)
            putExtra("CALLER_NAME", callerName)
            putExtra("IS_VIDEO_CALL", isVideo)
            putExtra("ROOM_URL", roomUrl)
            putExtra("ROOM_TOKEN", token)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val acceptPendingIntent = PendingIntent.getActivity(
            context, 1, acceptIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val rejectIntent = Intent(context, MainActivity::class.java)
        val rejectPendingIntent = PendingIntent.getActivity(
            context, 2, rejectIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_call)
            .setContentTitle("Incoming $callType")
            .setContentText("Call from $callerName")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setFullScreenIntent(acceptPendingIntent, true)
            .setColor(ContextCompat.getColor(context, R.color.yenkasa_black))
            .addAction(R.drawable.ic_call, "Accept", acceptPendingIntent)
            .addAction(R.drawable.ic_call_end, "Reject", rejectPendingIntent)

        if (soundUri != null) builder.setSound(soundUri)

        try {
            NotificationManagerCompat.from(context).notify(CALL_NOTIFICATION_ID, builder.build())
        } catch (e: SecurityException) {
            Log.w("NotificationHelper", "Unable to post notification: ${e.message}")
        }
    }

    private fun createCallChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ringtoneUri = try {
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            } catch (e: SecurityException) {
                Log.w("NotificationHelper", "No permission for ringtone: ${e.message}")
                null
            }

            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CALL_CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming calls"
                enableVibration(true)
                lightColor = Color.parseColor("#FFD54F")
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                if (ringtoneUri != null) setSound(ringtoneUri, attributes)
            }

            try {
                val manager = context.getSystemService(NotificationManager::class.java)
                manager.createNotificationChannel(channel)
            } catch (e: SecurityException) {
                Log.w("NotificationHelper", "Cannot create channel: ${e.message}")
            }
        }
    }

    // -------------------------------------------------------------------------
    // 💬 MESSAGE NOTIFICATIONS
    // -------------------------------------------------------------------------
    fun showMessageNotification(
        context: Context,
        senderName: String,
        message: String,
        chatId: String? = null
    ) {
        if (!context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
        ) {
            Log.d("NotificationHelper", "Message notification muted by user preferences.")
            return
        }

        if (!hasPostNotificationPermission(context)) {
            Log.w("NotificationHelper", "Notification permission denied; skipping message notification.")
            return
        }

        val channelId = NotificationSoundManager.ensureMessageChannel(context)
        val soundUri = NotificationSoundManager.getSoundUri(context)

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
            context, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_message)
            .setContentTitle("New message from $senderName")
            .setContentText(message.take(120))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setColor(ContextCompat.getColor(context, R.color.yenkasa_black))
            .setContentIntent(pendingIntent)

        builder.setSound(soundUri)

        try {
            NotificationManagerCompat.from(context)
                .notify(System.currentTimeMillis().toInt(), builder.build())
        } catch (e: SecurityException) {
            Log.w("NotificationHelper", "Unable to post message notification: ${e.message}")
        }
    }

}
