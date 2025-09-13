package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object TokenManager {

    // === Preference Keys ===
    private const val PREF_NAME = "secure_auth_prefs"
    private const val TOKEN_KEY = "auth_token"
    private const val REFRESH_KEY = "refresh_token"
    private const val USER_ID_KEY = "userId"
    private const val PROFILE_PIC_KEY = "profile_pic_url"
    private const val USERNAME_KEY = "username"
    private const val EMAIL_KEY = "email"
    private const val PHONE_KEY = "phone"
    private const val LOCATION_KEY = "location"

    // 👇 NEW KEY FOR ONESIGNAL PLAYER ID
    private const val ONE_SIGNAL_PLAYER_ID_KEY = "one_signal_player_id"
    // --- 👇 KEYS FOR SPECIFIC VERIFICATION STATUS (These should already be here from my last TokenManager update) ---
    private const val EMAIL_VERIFIED_KEY = "email_is_verified"
    private const val PHONE_VERIFIED_KEY = "phone_is_verified"
    // --- END OF SPECIFIC VERIFICATION KEYS ---

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
            // Consider using a different fallback name to avoid potential collisions
            // if the user somehow fixes the encryption issue later.
            return context.getSharedPreferences("${PREF_NAME}_unencrypted_fallback_token_manager", Context.MODE_PRIVATE)
        }
    }
    fun saveUserDetails(
        context: Context,
        userId: String?,
        username: String?,
        email: String?,
        phone: String?,
        isEmailActuallyVerified: Boolean, // Note: your User model might have Boolean? for isVerified
        isPhoneActuallyVerified: Boolean,
        profileImageUrl: String?,
        location: String? // Assuming location is also part of your User model
    ) {
        Log.d(TAG, "Attempting to save user details...")
        saveUserId(context, userId)
        saveUsername(context, username)
        saveEmail(context, email)
        savePhone(context, phone)
        //setEmailVerifiedStatus(context, isVerified) // Uses your existing setVerified method
        saveProfilePicUrl(context, profileImageUrl)
        saveLocation(context, location)
        Log.i(TAG, "User details batch save operation completed.")
    }
    // === END OF NEW FUNCTION ===

    // === Auth Token (Access Token) ===
    fun saveToken(context: Context, token: String?) {
        if (token.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty access token. Skipping save.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(TOKEN_KEY, token).apply()
            Log.i(TAG, "🔐 Access token saved successfully.") // Changed to INFO for successful save
        } catch (e: Exception) {
            Log.e(TAG, "Error saving access token to EncryptedSharedPreferences", e)
        }
    }

    fun getToken(context: Context): String? {
        return try {
            val token = getEncryptedPrefs(context).getString(TOKEN_KEY, null)
            if (token != null) {
                Log.d(TAG, "Retrieved access token (exists)") // Keep sensitive details out of default logs
            } else {
                Log.d(TAG, "Retrieved access token: null")
            }
            token
        } catch (e: Exception) {
            Log.e(TAG, "Error getting access token from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearToken(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(TOKEN_KEY).apply()
            Log.i(TAG, "Access token cleared.") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing access token from EncryptedSharedPreferences", e)
        }
    }

    // === Refresh Token ===
    fun saveRefreshToken(context: Context, refreshToken: String?) {
        if (refreshToken.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty refresh token. Skipping save.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(REFRESH_KEY, refreshToken).apply()
            Log.i(TAG, "🔑 Refresh token saved successfully.") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving refresh token to EncryptedSharedPreferences", e)
        }
    }

    fun getRefreshToken(context: Context): String? {
        return try {
            val token = getEncryptedPrefs(context).getString(REFRESH_KEY, null)
            if (token != null) {
                Log.d(TAG, "Retrieved refresh token (exists)")
            } else {
                Log.d(TAG, "Retrieved refresh token: null")
            }
            token
        } catch (e: Exception) {
            Log.e(TAG, "Error getting refresh token from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearRefreshToken(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(REFRESH_KEY).apply()
            Log.i(TAG, "Refresh token cleared.") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing refresh token from EncryptedSharedPreferences", e)
        }
    }

    // === User ID ===
    fun saveUserId(context: Context, userId: String?) {
        if (userId.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty User ID. Skipping save.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(USER_ID_KEY, userId).apply()
            Log.i(TAG, "User ID saved: $userId") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving User ID to EncryptedSharedPreferences", e)
        }
    }

    fun getUserId(context: Context): String? {
        return try {
            val userId = getEncryptedPrefs(context).getString(USER_ID_KEY, null)
            Log.d(TAG, "Retrieved User ID: $userId")
            userId
        } catch (e: Exception) {
            Log.e(TAG, "Error getting User ID from EncryptedSharedPreferences", e)
            null
        }
    }

    fun clearUserId(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(USER_ID_KEY).apply()
            Log.i(TAG, "User ID cleared.") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing User ID from EncryptedSharedPreferences", e)
        }
    }

    // === Profile Picture URL ===
    fun saveProfilePicUrl(context: Context, url: String?) {
        // Allow saving null/empty to clear the URL if needed
        try {
            getEncryptedPrefs(context).edit().putString(PROFILE_PIC_KEY, url).apply()
            Log.i(TAG, "Profile Pic URL saved: $url") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving Profile Pic URL", e)
        }
    }

    fun getProfilePicUrl(context: Context): String? {
        return try {
            val url = getEncryptedPrefs(context).getString(PROFILE_PIC_KEY, null)
            Log.d(TAG, "Retrieved Profile Pic URL: $url")
            url
        } catch (e: Exception) {
            Log.e(TAG, "Error getting Profile Pic URL", e)
            null
        }
    }
    // In your util/TokenManager.kt
    object TokenManager {
        // ... other constants and methods ...
        private const val KEY_EMAIL = "user_email"

        fun saveEmail(context: Context, email: String) {
            // Your SharedPreferences logic to save the email
            // Example: getEncryptedSharedPreferences(context).edit().putString(KEY_EMAIL, email).apply()
            Log.d("TokenManager", "Email saved: $email")
        }

        fun getEmail(context: Context): String? {
            // Your SharedPreferences logic to retrieve the email
            // Example: return getEncryptedSharedPreferences(context).getString(KEY_EMAIL, null)
            return "user@example.com" // Placeholder
        }
        // ...
    }
    // === Username ===
    fun saveUsername(context: Context, username: String?) {
        if (username.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty username. Skipping save.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(USERNAME_KEY, username).apply()
            Log.i(TAG, "Username saved: $username") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving username", e)
        }
    }

    fun getUsername(context: Context): String? {
        return try {
            val username = getEncryptedPrefs(context).getString(USERNAME_KEY, null)
            Log.d(TAG, "Retrieved Username: $username")
            username
        } catch (e: Exception) {
            Log.e(TAG, "Error getting username", e)
            null
        }
    }
    private fun getBoolean(context: Context, key: String, default: Boolean): Boolean {
        return try {
            getEncryptedPrefs(context).getBoolean(key, default)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading boolean key '$key': ${e.message}")
            default
        }
    }

    fun isEmailVerified(context: Context): Boolean {
        return getBoolean(context, "emailVerified", false)
    }

    fun isPhoneVerified(context: Context): Boolean {
        return getBoolean(context, "phoneVerified", false)
    }

    // === Email ===
    fun saveEmail(context: Context, email: String?) {
        if (email.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty email. Skipping save.")
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(EMAIL_KEY, email).apply()
            Log.i(TAG, "Email saved: $email") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving email", e)
        }
    }

    fun getEmail(context: Context): String? {
        return try {
            val email = getEncryptedPrefs(context).getString(EMAIL_KEY, null)
            Log.d(TAG, "Retrieved Email: $email")
            email
        } catch (e: Exception) {
            Log.e(TAG, "Error getting email", e)
            null
        }
    }

    // === Phone ===
    fun savePhone(context: Context, phone: String?) {
        // Allow saving null/empty to clear
        try {
            getEncryptedPrefs(context).edit().putString(PHONE_KEY, phone).apply()
            Log.i(TAG, "Phone saved: $phone") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving phone", e)
        }
    }

    fun getPhone(context: Context): String? {
        return try {
            val phone = getEncryptedPrefs(context).getString(PHONE_KEY, null)
            Log.d(TAG, "Retrieved Phone: $phone")
            phone
        } catch (e: Exception) {
            Log.e(TAG, "Error getting phone", e)
            null
        }
    }

    // === Location ===
    fun saveLocation(context: Context, location: String?) {
        // Allow saving null/empty to clear
        try {
            getEncryptedPrefs(context).edit().putString(LOCATION_KEY, location).apply()
            Log.i(TAG, "Location saved: $location") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error saving location", e)
        }
    }

    fun getLocation(context: Context): String? {
        return try {
            val location = getEncryptedPrefs(context).getString(LOCATION_KEY, null)
            Log.d(TAG, "Retrieved Location: $location")
            location
        } catch (e: Exception) {
            Log.e(TAG, "Error getting location", e)
            null
        }
    }

    // === Verified Status ===



    // === 👇 ONESIGNAL PLAYER ID METHODS (LOGGING ALREADY GOOD) ===

    /**
     * Saves the OneSignal Player ID to EncryptedSharedPreferences.
     */
    fun saveOneSignalPlayerId(context: Context, playerId: String?) {
        if (playerId.isNullOrBlank()) {
            Log.w(TAG, "⚠️ Tried to save a null or empty OneSignal Player ID. Clearing if one exists.")
            clearOneSignalPlayerId(context) // Clear any existing one
            return
        }
        try {
            getEncryptedPrefs(context).edit().putString(ONE_SIGNAL_PLAYER_ID_KEY, playerId).apply()
            Log.i(TAG, "🔒 OneSignal Player ID saved successfully: $playerId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving OneSignal Player ID to EncryptedSharedPreferences", e)
        }
    }

    /**
     * Retrieves the OneSignal Player ID from EncryptedSharedPreferences.
     */
    fun getOneSignalPlayerId(context: Context): String? {
        return try {
            val playerId = getEncryptedPrefs(context).getString(ONE_SIGNAL_PLAYER_ID_KEY, null)
            // Log the actual Player ID if it exists for easier debugging
            Log.d(TAG, "Retrieved OneSignal Player ID: $playerId")
            playerId
        } catch (e: Exception) {
            Log.e(TAG, "Error getting OneSignal Player ID from EncryptedSharedPreferences", e)
            null
        }
    }

    /**
     * Clears the OneSignal Player ID from EncryptedSharedPreferences.
     */
    fun clearOneSignalPlayerId(context: Context) {
        try {
            // Check if it exists before trying to remove, to make the log more accurate
            val existingPlayerId = getEncryptedPrefs(context).getString(ONE_SIGNAL_PLAYER_ID_KEY, null)
            if (existingPlayerId != null) {
                getEncryptedPrefs(context).edit().remove(ONE_SIGNAL_PLAYER_ID_KEY).apply()
                Log.i(TAG, "OneSignal Player ID '$existingPlayerId' cleared.")
            } else {
                Log.d(TAG, "Attempted to clear OneSignal Player ID, but none was found.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing OneSignal Player ID from EncryptedSharedPreferences", e)
        }
    }
    fun setEmailVerifiedStatus(context: Context, isVerified: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(EMAIL_VERIFIED_KEY, isVerified).apply()
            Log.i(TAG, "Email verified status in TokenManager set to: $isVerified")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting email verified status: ${e.message}", e)
        }
    }
    // === END OF setEmailVerifiedStatus DEFINITION ===

    // === 👇 DECLARE AND DEFINE setPhoneVerifiedStatus HERE ===
    fun setPhoneVerifiedStatus(context: Context, isVerified: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(PHONE_VERIFIED_KEY, isVerified).apply()
            Log.i(TAG, "Phone verified status in TokenManager set to: $isVerified")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting phone verified status: ${e.message}", e)
        }
    }
    // === Clear All ===
    fun clearAll(context: Context) {
        try {
            getEncryptedPrefs(context).edit()
                .remove(TOKEN_KEY)
                .remove(REFRESH_KEY)
                .remove(USER_ID_KEY)
                .remove(PROFILE_PIC_KEY)
                .remove(USERNAME_KEY)
                .remove(EMAIL_KEY)
                .remove(PHONE_KEY)
                .remove(LOCATION_KEY)
                .remove(EMAIL_VERIFIED_KEY)
                .remove(PHONE_VERIFIED_KEY)
                .remove(ONE_SIGNAL_PLAYER_ID_KEY) // ✅ Also clear Player ID
                .apply()
            Log.i(TAG, "All data cleared from EncryptedSharedPreferences.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing all data from EncryptedSharedPreferences", e)
        }
    }
}
