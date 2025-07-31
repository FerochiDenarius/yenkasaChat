package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log

object TokenManager {

    // === Preference Keys ===
    private const val PREF_NAME = "auth_tokens"
    private const val TOKEN_KEY = "auth_token"
    private const val REFRESH_KEY = "refresh_token"
    private const val USER_ID_KEY = "userId"
    private const val PROFILE_PIC_KEY = "profile_pic_url"
    private const val USERNAME_KEY = "username"
    private const val EMAIL_KEY = "email"
    private const val PHONE_KEY = "phone"
    private const val LOCATION_KEY = "location"
    private const val VERIFIED_KEY = "is_verified"


    // === SharedPreferences Access ===
    private fun getPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    // === Auth Token ===
    fun saveToken(context: Context, token: String) {
        if (token.isNotBlank()) {
            getPrefs(context).edit().putString(TOKEN_KEY, token).apply()
        } else {
            Log.w("TokenManager", "⚠️ Tried to save an empty token")
        }
        Log.d("TokenManager", "🔐 Saving token: $token")

    }


    fun getToken(context: Context): String? =
        getPrefs(context).getString(TOKEN_KEY, null)

    fun clearToken(context: Context) {
        getPrefs(context).edit().remove(TOKEN_KEY).apply()
    }

    // === Refresh Token ===
    fun saveRefreshToken(context: Context, refreshToken: String) {
        getPrefs(context).edit().putString(REFRESH_KEY, refreshToken).apply()
    }

    fun getRefreshToken(context: Context): String? =
        getPrefs(context).getString(REFRESH_KEY, null)

    // === User ID ===
    fun saveUserId(context: Context, userId: String) {
        getPrefs(context).edit().putString(USER_ID_KEY, userId).apply()
    }

    fun getUserId(context: Context): String? =
        getPrefs(context).getString(USER_ID_KEY, null)

    fun clearUserId(context: Context) {
        getPrefs(context).edit().remove(USER_ID_KEY).apply()
    }

    // === Profile Picture URL ===
    fun saveProfilePicUrl(context: Context, url: String) {
        getPrefs(context).edit().putString(PROFILE_PIC_KEY, url).apply()
    }

    fun getProfilePicUrl(context: Context): String? =
        getPrefs(context).getString(PROFILE_PIC_KEY, null)

    // === Username ===
    fun saveUsername(context: Context, username: String) {
        getPrefs(context).edit().putString(USERNAME_KEY, username).apply()
    }

    fun getUsername(context: Context): String? =
        getPrefs(context).getString(USERNAME_KEY, null)

    // === Email ===
    fun saveEmail(context: Context, email: String) {
        getPrefs(context).edit().putString(EMAIL_KEY, email).apply()
    }

    fun getEmail(context: Context): String? =
        getPrefs(context).getString(EMAIL_KEY, null)

    // === Clear All ===
    fun clearAll(context: Context) {
        getPrefs(context).edit().clear().apply()
    }

    fun savePhone(context: Context, phone: String) {
        getPrefs(context).edit().putString(PHONE_KEY, phone).apply()
    }

    fun getPhone(context: Context): String? =
        getPrefs(context).getString(PHONE_KEY, null)

    fun saveLocation(context: Context, location: String) {
        getPrefs(context).edit().putString(LOCATION_KEY, location).apply()
    }

    fun getLocation(context: Context): String? =
        getPrefs(context).getString(LOCATION_KEY, null)

    fun setVerified(context: Context, isVerified: Boolean) {
        getPrefs(context).edit().putBoolean(VERIFIED_KEY, isVerified).apply()
    }

    fun isVerified(context: Context): Boolean =
        getPrefs(context).getBoolean(VERIFIED_KEY, false)

}
