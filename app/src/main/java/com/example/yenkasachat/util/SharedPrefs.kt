package com.example.yenkasachat.utils

import android.content.Context
import android.content.SharedPreferences

object SharedPrefs {

    private const val PREFS_NAME = "yenkasa_chat_prefs"
    private const val KEY_TOKEN = "auth_token"

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
}
