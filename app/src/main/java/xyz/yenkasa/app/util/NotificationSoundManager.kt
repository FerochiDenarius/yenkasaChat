package xyz.yenkasa.app.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.util.Log
import xyz.yenkasa.app.R

object NotificationSoundManager {
    private const val PREFS_NAME = "settings"
    private const val KEY_NOTIFICATION_SOUND = "notification_sound"
    private const val BASE_CHANNEL_ID = "yenkasachat_chat_messages_v3"
    private const val CHANNEL_NAME = "Yenkasa Notifications"

    private val soundResources = mapOf(
        "sound_default" to R.raw.sound_default,
        "sound_chime" to R.raw.sound_chime,
        "sound_bell" to R.raw.sound_bell,
        "sound_soft" to R.raw.sound_soft,
        "sound_alert" to R.raw.sound_alert
    )

    fun getSelectedSoundId(context: Context): String {
        val selected = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_NOTIFICATION_SOUND, "sound_default")
            ?: "sound_default"
        return selected.takeIf { it in soundResources } ?: "sound_default"
    }

    fun saveSelectedSound(context: Context, soundId: String) {
        val normalized = soundId.takeIf { it in soundResources } ?: "sound_default"
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_NOTIFICATION_SOUND, normalized)
            .apply()
        ensureMessageChannel(context, normalized)
    }

    fun getSoundUri(context: Context, soundId: String = getSelectedSoundId(context)): Uri {
        val resId = soundResources[soundId] ?: R.raw.sound_default
        return Uri.parse("android.resource://${context.packageName}/$resId")
    }

    fun getMessageChannelId(context: Context): String {
        return channelIdFor(getSelectedSoundId(context))
    }

    fun ensureMessageChannel(context: Context, soundId: String = getSelectedSoundId(context)): String {
        val channelId = channelIdFor(soundId)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return channelId

        val manager = context.getSystemService(NotificationManager::class.java) ?: return channelId
        val existing = manager.getNotificationChannel(channelId)
        if (existing != null && existing.sound == getSoundUri(context, soundId)) {
            return channelId
        }

        val audioAttrs = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val channel = NotificationChannel(
            channelId,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifications for Yenkasa activities"
            enableLights(true)
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 200, 150, 200)
            setSound(getSoundUri(context, soundId), audioAttrs)
        }

        manager.createNotificationChannel(channel)
        return channelId
    }

    fun playPreview(context: Context, soundId: String) {
        val normalized = soundId.takeIf { it in soundResources } ?: "sound_default"
        val resId = soundResources[normalized] ?: R.raw.sound_default
        runCatching {
            MediaPlayer.create(context.applicationContext, resId)?.apply {
                setOnCompletionListener { player -> player.release() }
                setOnErrorListener { player, _, _ ->
                    player.release()
                    true
                }
                start()
            }
        }.onFailure {
            Log.w("NotificationSound", "Unable to preview sound '$normalized': ${it.message}")
        }
    }

    private fun channelIdFor(soundId: String): String {
        val normalized = soundId.takeIf { it in soundResources } ?: "sound_default"
        return "${BASE_CHANNEL_ID}_$normalized"
    }
}
