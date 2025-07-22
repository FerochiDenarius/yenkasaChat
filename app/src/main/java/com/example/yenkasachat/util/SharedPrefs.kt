package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences

object SharedPrefs {

    private const val PREFS_NAME = "yenkasa_chat_prefs"
    private const val KEY_TOKEN = "auth_token"
    private const val KEY_USER_ID = "user_id"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)

    fun clearToken(context: Context) {
        prefs(context).edit().remove(KEY_TOKEN).apply()
    }

    fun saveUserId(context: Context, userId: String) {
        prefs(context).edit().putString(KEY_USER_ID, userId).apply()
    }

    fun getUserId(context: Context): String? =
        prefs(context).getString(KEY_USER_ID, null)

    fun clearUserId(context: Context) {
        prefs(context).edit().remove(KEY_USER_ID).apply()
    }
}
