package xyz.yenkasa.app.yme

import android.content.Context
import java.util.UUID

class YmeSessionManager(
    context: Context,
) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun touchSession(nowMs: Long = System.currentTimeMillis()): String {
        val currentSessionId = prefs.getString(KEY_SESSION_ID, null)
        val lastActiveAt = prefs.getLong(KEY_LAST_ACTIVE_AT, 0L)
        val isExpired = currentSessionId.isNullOrBlank() || nowMs - lastActiveAt > SESSION_TIMEOUT_MS
        val sessionId = if (isExpired) UUID.randomUUID().toString() else currentSessionId.orEmpty()

        prefs.edit()
            .putString(KEY_SESSION_ID, sessionId)
            .putLong(KEY_LAST_ACTIVE_AT, nowMs)
            .putLong(KEY_STARTED_AT, prefs.getLong(KEY_STARTED_AT, nowMs).takeIf { !isExpired } ?: nowMs)
            .apply()

        return sessionId
    }

    fun activeDurationMs(nowMs: Long = System.currentTimeMillis()): Long {
        val startedAt = prefs.getLong(KEY_STARTED_AT, nowMs)
        return (nowMs - startedAt).coerceAtLeast(0L)
    }

    fun endSession() {
        prefs.edit()
            .remove(KEY_SESSION_ID)
            .remove(KEY_LAST_ACTIVE_AT)
            .remove(KEY_STARTED_AT)
            .apply()
    }

    companion object {
        private const val PREFS_NAME = "yme_session"
        private const val KEY_SESSION_ID = "session_id"
        private const val KEY_LAST_ACTIVE_AT = "last_active_at"
        private const val KEY_STARTED_AT = "started_at"
        private const val SESSION_TIMEOUT_MS = 30 * 60 * 1000L
    }
}
