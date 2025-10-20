package com.example.yenkasachat.ui

import android.Manifest
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
import com.example.yenkasachat.R
import org.json.JSONObject

object CallNotificationHandler {

    private const val TAG = "CallNotificationHandler"
    private const val CALL_CHANNEL_ID = "yenkasachat_calls"
    private const val CALL_NOTIFICATION_ID = 9999

    /**
     * Show an incoming call notification (works in background too).
     */
    fun showIncomingCall(context: Context, data: JSONObject) {
        try {
            val callerName = data.optString("callerName", "Unknown")
            val callerId = data.optString("callerId", "")
            val isVideo = data.optString("callType", "video") == "video"
            val roomUrl = data.optString("roomUrl", "")
            val token = data.optString("token", "")

            Log.d(TAG, "📞 Incoming ${if (isVideo) "Video" else "Audio"} Call from $callerName ($callerId)")

            createCallNotificationChannel(context)

            // ✅ Safely get ringtone (Android 13+ may throw SecurityException)
            val ringtoneUri = if (hasNotificationPermission(context)) {
                try {
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                } catch (e: SecurityException) {
                    Log.w(TAG, "No permission for ringtone sound: ${e.message}")
                    null
                }
            } else {
                Log.w(TAG, "POST_NOTIFICATIONS permission not granted; skipping ringtone")
                null
            }

            // ✅ Intent to open IncomingCallActivity when ACCEPTED
            val acceptIntent = Intent(context, IncomingCallActivity::class.java).apply {
                putExtra("CALLER_ID", callerId)
                putExtra("CALLER_NAME", callerName)
                putExtra("IS_VIDEO_CALL", isVideo)
                putExtra("ROOM_URL", roomUrl)
                putExtra("ROOM_TOKEN", token)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP)            }

            val acceptPendingIntent = PendingIntent.getActivity(
                context,
                1,
                acceptIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            // ✅ Intent to reject/dismiss
            val rejectIntent = Intent(Intent.ACTION_CLOSE_SYSTEM_DIALOGS)
            val rejectPendingIntent = PendingIntent.getBroadcast(
                context,
                2,
                rejectIntent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )

            val builder = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.sym_action_call)
                .setContentTitle("Incoming ${if (isVideo) "Video" else "Audio"} Call")
                .setContentText("Call from $callerName")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setOngoing(true)
                .setColor(Color.parseColor("#25D366"))
                .setAutoCancel(true)
                .addAction(R.drawable.ic_call, "Accept", acceptPendingIntent)
                .addAction(R.drawable.ic_call_end, "Reject", rejectPendingIntent)
                .setFullScreenIntent(acceptPendingIntent, true) // ⚡ show even on lock screen

            if (ringtoneUri != null) builder.setSound(ringtoneUri)

// ✅ Safe notification post with runtime permission check
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(
                    context,
                    android.Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                NotificationManagerCompat.from(context).notify(CALL_NOTIFICATION_ID, builder.build())
            } else {
                Log.w(TAG, "🔕 Notification permission not granted; skipping notification display")
            }

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error showing incoming call notification: ${e.message}", e)
        }
    }

    /**
     * Handle user tapping the notification when app is resumed.
     */
    fun handleNotificationOpened(context: Context, data: JSONObject) {
        try {
            val callerId = data.optString("callerId", "")
            val callerName = data.optString("callerName", "Unknown")
            val isVideo = data.optString("callType", "video") == "video"
            val roomUrl = data.optString("roomUrl", "")
            val token = data.optString("token", "")

            val intent = Intent(context, IncomingCallActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("CALLER_ID", callerId)
                putExtra("CALLER_NAME", callerName)
                putExtra("IS_VIDEO_CALL", isVideo)
                putExtra("ROOM_URL", roomUrl)
                putExtra("ROOM_TOKEN", token)
            }
            context.startActivity(intent)

        } catch (e: Exception) {
            Log.e(TAG, "Error handling call notification opened", e)
        }
    }

    private fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun createCallNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ringtoneUri = if (hasNotificationPermission(context)) {
                try {
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                } catch (e: SecurityException) {
                    Log.w(TAG, "No permission for ringtone sound in channel: ${e.message}")
                    null
                }
            } else {
                null
            }

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                CALL_CHANNEL_ID,
                "Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming video/audio calls"
                enableVibration(true)
                lightColor = Color.GREEN
                lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
                if (ringtoneUri != null) {
                    setSound(ringtoneUri, audioAttributes)
                } else {
                    setSound(null, null) // no permission: silent fallback
                }
            }

            val manager = context.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
