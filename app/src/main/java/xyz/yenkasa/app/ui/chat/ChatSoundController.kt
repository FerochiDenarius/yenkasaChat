package xyz.yenkasa.app.ui.chat

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import android.os.SystemClock
import android.util.Log
import xyz.yenkasa.app.R

class ChatSoundController(context: Context) {
    private val appContext = context.applicationContext
    private var soundPool: SoundPool? = null
    private var inChatMessageSoundId: Int = 0
    private var laughReactionSoundId: Int = 0
    private val loadedSoundIds = mutableSetOf<Int>()
    private var lastInChatMessageSoundAt: Long = 0L
    private var lastLaughReactionSentAt: Long = 0L
    private var lastLaughReactionPlayedAt: Long = 0L
    private val fallbackSoundPlayers = mutableSetOf<MediaPlayer>()

    fun initialize() {
        if (soundPool != null) return

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(attributes)
            .build()
            .also { pool ->
                pool.setOnLoadCompleteListener { _, sampleId, status ->
                    if (status == 0) loadedSoundIds.add(sampleId)
                }
                inChatMessageSoundId = pool.load(appContext, R.raw.in_chat_message, 1)
                laughReactionSoundId = pool.load(appContext, R.raw.chat_laugh_reaction, 1)
            }
    }

    fun tryMarkLaughReactionSent(): Boolean {
        val now = SystemClock.elapsedRealtime()
        if (now - lastLaughReactionSentAt < LAUGH_REACTION_COOLDOWN_MS) return false
        lastLaughReactionSentAt = now
        return true
    }

    fun playInChatMessageSound(isChatVisible: Boolean) {
        if (!isChatVisible || !isInChatSoundsEnabled()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastInChatMessageSoundAt < IN_CHAT_MESSAGE_SOUND_COOLDOWN_MS) return
        lastInChatMessageSoundAt = now
        playChatSound(inChatMessageSoundId, R.raw.in_chat_message)
    }

    fun playLaughReactionSound(isChatVisible: Boolean) {
        if (!isChatVisible || !isReactionSoundsEnabled()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastLaughReactionPlayedAt < LAUGH_REACTION_COOLDOWN_MS) return
        lastLaughReactionPlayedAt = now
        playChatSound(laughReactionSoundId, R.raw.chat_laugh_reaction)
    }

    private fun playChatSound(soundId: Int, rawFallbackRes: Int) {
        val pool = soundPool
        if (pool != null && soundId != 0 && loadedSoundIds.contains(soundId)) {
            pool.play(soundId, 1f, 1f, 1, 0, 1f)
            return
        }

        runCatching {
            MediaPlayer.create(appContext, rawFallbackRes)?.apply {
                fallbackSoundPlayers.add(this)
                setOnCompletionListener { player ->
                    fallbackSoundPlayers.remove(player)
                    player.release()
                }
                setOnErrorListener { player, _, _ ->
                    fallbackSoundPlayers.remove(player)
                    player.release()
                    true
                }
                start()
            }
        }.onFailure { error ->
            Log.w(TAG, "Unable to play chat sound: ${error.message}")
        }
    }

    fun release() {
        soundPool?.release()
        soundPool = null
        fallbackSoundPlayers.toList().forEach { player ->
            runCatching {
                if (player.isPlaying) player.stop()
                player.release()
            }
        }
        fallbackSoundPlayers.clear()
        loadedSoundIds.clear()
        inChatMessageSoundId = 0
        laughReactionSoundId = 0
    }

    private fun isInChatSoundsEnabled(): Boolean {
        return appContext.getSharedPreferences(CHAT_SOUND_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_IN_CHAT_MESSAGE_SOUNDS_ENABLED, true)
    }

    private fun isReactionSoundsEnabled(): Boolean {
        return appContext.getSharedPreferences(CHAT_SOUND_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_REACTION_SOUNDS_ENABLED, true)
    }

    private companion object {
        const val TAG = "ChatSoundController"
        const val CHAT_SOUND_PREFS = "chat_sound_settings"
        const val KEY_IN_CHAT_MESSAGE_SOUNDS_ENABLED = "in_chat_message_sounds_enabled"
        const val KEY_REACTION_SOUNDS_ENABLED = "reaction_sounds_enabled"
        const val IN_CHAT_MESSAGE_SOUND_COOLDOWN_MS = 450L
        const val LAUGH_REACTION_COOLDOWN_MS = 2500L
    }
}
