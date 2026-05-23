package xyz.yenkasa.app.util

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

internal object SecurePrefsStore {
    private const val TAG = "SecurePrefsStore"
    private const val PREF_NAME = "secure_auth_prefs"
    private const val FEED_CACHE_PREF_NAME = "yenkasa_cache"

    @Volatile
    private var cachedEncryptedPrefs: SharedPreferences? = null
    private val prefsLock = Any()

    fun encryptedPrefs(context: Context): SharedPreferences {
        cachedEncryptedPrefs?.let { return it }
        return synchronized(prefsLock) {
            cachedEncryptedPrefs ?: createEncryptedPrefs(context.applicationContext).also {
                cachedEncryptedPrefs = it
            }
        }
    }

    fun feedCachePrefs(context: Context): SharedPreferences {
        return context.applicationContext.getSharedPreferences(
            FEED_CACHE_PREF_NAME,
            Context.MODE_PRIVATE
        )
    }

    private fun createEncryptedPrefs(context: Context): SharedPreferences {
        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREF_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            cachedEncryptedPrefs = null
            Log.e(
                TAG,
                "EncryptedSharedPreferences corrupted. Clearing and falling back safely.",
                e
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                context.deleteSharedPreferences(PREF_NAME)
            } else {
                context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .commit()
            }

            context.getSharedPreferences(
                "${PREF_NAME}_unencrypted_fallback_token_manager",
                Context.MODE_PRIVATE
            )
        }
    }
}
