package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences

object TokenManager {
    private const val PREF_NAME = "auth"  // ✅ match what's used in MainActivity
    private const val TOKEN_KEY = "auth_token"

    fun saveToken(context: Context, token: String) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(TOKEN_KEY, token).apply()
    }

    fun getToken(context: Context): String? {
        val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        return prefs.getString(TOKEN_KEY, null)
    }

    fun clearToken(context: Context) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(TOKEN_KEY).apply()
    }
}
