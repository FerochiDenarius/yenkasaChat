package com.example.yenkasachat.util

import android.content.Context
import android.net.Uri
import android.preference.PreferenceManager

object ChatBackgroundManager {
    private const val KEY_CHAT_BG_URI = "chat_background_uri"
    private const val KEY_CHAT_BG_PRESET = "chat_background_preset"

    fun saveBackgroundUri(context: Context, uri: Uri) {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        prefs.edit().putString(KEY_CHAT_BG_URI, uri.toString()).apply()
        prefs.edit().remove(KEY_CHAT_BG_PRESET).apply()
    }

    fun savePreset(context: Context, presetName: String) {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        prefs.edit().putString(KEY_CHAT_BG_PRESET, presetName).apply()
        prefs.edit().remove(KEY_CHAT_BG_URI).apply()
    }

    fun getBackgroundUri(context: Context): Uri? {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        val s = prefs.getString(KEY_CHAT_BG_URI, null) ?: return null
        return try {
            Uri.parse(s)
        } catch (e: Exception) {
            null
        }
    }

    fun getPreset(context: Context): String? {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        return prefs.getString(KEY_CHAT_BG_PRESET, null)
    }

    fun clearBackground(context: Context) {
        val prefs = PreferenceManager.getDefaultSharedPreferences(context)
        prefs.edit().remove(KEY_CHAT_BG_URI).remove(KEY_CHAT_BG_PRESET).apply()
    }
}
