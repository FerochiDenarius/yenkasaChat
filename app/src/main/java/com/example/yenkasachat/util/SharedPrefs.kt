package com.example.yenkasachat.util

import android.content.Context

object SharedPrefs {

    private const val PREFS_NAME = "yenkasa_chat_prefs"
    private const val KEY_TOKEN = "token"
    private const val KEY_USER_ID = "userId"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveToken(context: Context, token: String?) {
        token?.let {
            prefs(context).edit().putString(KEY_TOKEN, it).apply()
        }
    }

    fun getToken(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)

    fun clearToken(context: Context) {
        prefs(context).edit().remove(KEY_TOKEN).apply()
    }

    fun saveUserId(context: Context, userId: String?) {
        userId?.let {
            prefs(context).edit().putString(KEY_USER_ID, it).apply()
        }
    }

    fun getUserId(context: Context): String? =
        prefs(context).getString(KEY_USER_ID, null)

    fun clearUserId(context: Context) {
        prefs(context).edit().remove(KEY_USER_ID).apply()
    }
}
