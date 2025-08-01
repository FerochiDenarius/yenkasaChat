package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences // For encrypted preferences
import androidx.security.crypto.MasterKey             // For EncryptedSharedPreferences

object TokenManager {

    // === Preference Keys ===
    private const val PREF_NAME = "secure_auth_prefs" // Changed for EncryptedSharedPreferences
    private const val TOKEN_KEY = "auth_token"
    private const val REFRESH_KEY = "refresh_token" // This will now be encrypted
    private const val USER_ID_KEY = "userId"
    private const val PROFILE_PIC_KEY = "profile_pic_url"
    private const val USERNAME_KEY = "username"
    private const val EMAIL_KEY = "email"
    private const val PHONE_KEY = "phone"
    private const val LOCATION_KEY = "location"
    private const val VERIFIED_KEY = "is_verified"

    // Logging Tag
    private const val TAG = "TokenManager"

    // === EncryptedSharedPreferences Access ===
    private fun getEncryptedPrefs(context: Context): SharedPreferences {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            return EncryptedSharedPreferences.create(
                context,
                PREF_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing EncryptedSharedPreferences. Falling back to regular SharedPreferences for this session.", e)
            // Fallback for safety, though ideally, you'd handle this more gracefully
            // or decide if the app can function without secure prefs.
            // For critical auth data, crashing might be safer than insecure storage if encryption fails.
            // However, this fallback makes it more resilient to MasterKey issues on certain devices.
            return context.getSharedPreferences("${PREF_NAME}_unencrypted_fallback", Context.MODE_PRIVATE)
        }
    }

    // === Auth Token (Access Token) ===
    // Access tokens are short-lived, so encryption is beneficial but less critical than refresh tokens.
    // Storing it encrypted for consistency.
    fun saveToken(context: Context, token: String?) {
        if (token.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty access token.")
            // Optionally clear it if it's intentionally being set to null/empty
            // getEncryptedPrefs(context).edit().remove(TOKEN_KEY).apply()
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(TOKEN_KEY, token).apply()
            Log.d(TAG, "🔐 Access token saved successfully.")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving access token to EncryptedSharedPreferences", e)
        }
    }

    fun getToken(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(TOKEN_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting access token from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearToken(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(TOKEN_KEY).apply()
            Log.d(TAG, "Access token cleared.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing access token from EncryptedSharedPreferences", e)
        }
    }

    // === Refresh Token (More sensitive, benefits most from encryption) ===
    fun saveRefreshToken(context: Context, refreshToken: String?) {
        if (refreshToken.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty refresh token.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(REFRESH_KEY, refreshToken).apply()
            Log.d(TAG, "🔑 Refresh token saved successfully (encrypted).")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving refresh token to EncryptedSharedPreferences", e)
        }
    }

    fun getRefreshToken(context: Context): String? {
        return try {
            val token = getEncryptedPrefs(context).getString(REFRESH_KEY, null)
            // Log.d(TAG, "Retrieved refresh token (encrypted): ${if (token != null) "exists" else "null"}") // Don't log the token itself
            token
        } catch (e: Exception) {
            Log.e(TAG, "Error getting refresh token from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearRefreshToken(context: Context) { // Added specific clear for refresh token
        try {
            getEncryptedPrefs(context).edit().remove(REFRESH_KEY).apply()
            Log.d(TAG, "Refresh token cleared.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing refresh token from EncryptedSharedPreferences", e)
        }
    }

    // === User ID ===
    fun saveUserId(context: Context, userId: String?) {
        if (userId.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty User ID.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(USER_ID_KEY, userId).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving User ID to EncryptedSharedPreferences", e)
        }
    }

    fun getUserId(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(USER_ID_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting User ID from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearUserId(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(USER_ID_KEY).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing User ID from EncryptedSharedPreferences", e)
        }
    }


    // === Profile Picture URL === (Typically not sensitive, but stored in same pref file)
    fun saveProfilePicUrl(context: Context, url: String?) {
        // Allow null to clear it
        try {
            getEncryptedPrefs(context).edit().putString(PROFILE_PIC_KEY, url).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving Profile Pic URL to EncryptedSharedPreferences", e)
        }
    }

    fun getProfilePicUrl(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(PROFILE_PIC_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting Profile Pic URL from EncryptedSharedPreferences", e)
            null
        }
    }

    // === Username ===
    fun saveUsername(context: Context, username: String?) {
        if (username.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty username.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(USERNAME_KEY, username).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving username to EncryptedSharedPreferences", e)
        }
    }

    fun getUsername(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(USERNAME_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting username from EncryptedSharedPreferences", e)
            null
        }
    }

    // === Email ===
    fun saveEmail(context: Context, email: String?) {
        if (email.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty email.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(EMAIL_KEY, email).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving email to EncryptedSharedPreferences", e)
        }
    }

    fun getEmail(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(EMAIL_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting email from EncryptedSharedPreferences", e)
            null
        }
    }

    // === Phone ===
    fun savePhone(context: Context, phone: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(PHONE_KEY, phone).apply() // Allow null to clear
        } catch (e: Exception) {
            Log.e(TAG, "Error saving phone to EncryptedSharedPreferences", e)
        }
    }

    fun getPhone(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(PHONE_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting phone from EncryptedSharedPreferences", e)
            null
        }
    }

    // === Location ===
    fun saveLocation(context: Context, location: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(LOCATION_KEY, location).apply() // Allow null to clear
        } catch (e: Exception) {
            Log.e(TAG, "Error saving location to EncryptedSharedPreferences", e)
        }
    }

    fun getLocation(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(LOCATION_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting location from EncryptedSharedPreferences", e)
            null
        }
    }

    // === Verified Status ===
    fun setVerified(context: Context, isVerified: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(VERIFIED_KEY, isVerified).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error setting verified status in EncryptedSharedPreferences", e)
        }
    }

    fun isVerified(context: Context): Boolean {
        return try {
            getEncryptedPrefs(context).getBoolean(VERIFIED_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting verified status from EncryptedSharedPreferences", e)
            false // Default to false on error
        }
    }

    // === Clear All ===
    fun clearAll(context: Context) {
        try {
            getEncryptedPrefs(context).edit().clear().apply()
            Log.i(TAG, "All data cleared from EncryptedSharedPreferences.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing EncryptedSharedPreferences", e)
        }
    }
}
