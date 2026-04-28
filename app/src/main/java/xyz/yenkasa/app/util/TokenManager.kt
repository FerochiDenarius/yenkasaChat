package xyz.yenkasa.app.util

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.model.TransactionUiModel
import org.json.JSONObject
import android.os.Build



object TokenManager {

    // === Preference Keys ===
    private const val PREF_NAME = "secure_auth_prefs"
    private const val TOKEN_KEY = "auth_token"
    private const val REFRESH_KEY = "refresh_token"
    // === Admin Flag ===
    private const val ADMIN_KEY = "is_admin"
    private const val USER_ID_KEY = "userId"
    private const val PROFILE_PIC_KEY = "profile_pic_url"
    private const val USERNAME_KEY = "username"
    private const val EMAIL_KEY = "email"
    private const val PHONE_KEY = "phone"
    private const val LOCATION_KEY = "location"
    private const val VERIFIED_KEY = "is_verified"
    // 👇 NEW KEY FOR ONESIGNAL PLAYER ID
    private const val ONE_SIGNAL_PLAYER_ID_KEY = "one_signal_player_id"
    // === Role Flags ===
    private const val IS_ADMIN_KEY = "is_admin"
    private const val IS_MODERATOR_KEY = "is_moderator"
    private const val IS_DEVELOPER_KEY = "is_developer"
    private const val COMMUNITY_ID_KEY = "community_id"
    private const val SELECTED_COMMUNITY_IDS_KEY_PREFIX = "selected_community_ids_"
    private const val RECENT_POSTED_COMMUNITY_IDS_KEY = "recent_posted_community_ids"
    // Logging Tag
    private const val TAG = "TokenManager"
    private const val GENDER_KEY = "user_gender"
    private const val DOB_KEY = "user_dob"
    private const val DASHBOARD_CACHE_KEY = "verification_dashboard_json"
    private const val FEED_CACHE_PREF_NAME = "yenkasa_cache"
    private const val FEED_CACHE_KEY = "feed_cache"
    private const val FEED_CACHE_COMMUNITY_NAMES_KEY = "feed_cache_community_names"
    private const val FIRST_LAUNCH_KEY = "first_launch_completed"
    private const val POLICIES_ACCEPTED_KEY = "policies_accepted"
    private const val EMAIL_VERIFIED_KEY = "email_verified"
    private const val PHONE_VERIFIED_KEY = "phone_verified"
    private const val MAX_RECENT_POSTED_COMMUNITIES = 12





    // === EncryptedSharedPreferences Access ===
    @Volatile
    private var cachedEncryptedPrefs: SharedPreferences? = null
    private val prefsLock = Any()

    private fun getEncryptedPrefs(context: Context): SharedPreferences {
        cachedEncryptedPrefs?.let { return it }
        return synchronized(prefsLock) {
            cachedEncryptedPrefs ?: createEncryptedPrefs(context.applicationContext).also {
                cachedEncryptedPrefs = it
            }
        }
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

            // 🔥 CRITICAL FIX: remove corrupted encrypted storage
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                context.deleteSharedPreferences(PREF_NAME)
            } else {
                context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .clear()
                    .commit()
            }


            // ✅ Fallback remains EXACTLY as before (login safe)
            context.getSharedPreferences(
                "${PREF_NAME}_unencrypted_fallback_token_manager",
                Context.MODE_PRIVATE
            )
        }
    }
    fun saveUserDetails(
        context: Context,
        userId: String?,
        username: String?,
        email: String?,
        phone: String?,
        isVerified: Boolean, // User verification flag
        profileImageUrl: String?,
        location: String?, // User’s location
        coinsBalance: Int? = 0,
        communityName: String? = null,
        joinDate: String? = null
    ) {
        Log.d(TAG, "Attempting to save user details...")

        // 🧩 Core user data
        saveUserId(context, userId)
        saveUsername(context, username)
        saveEmail(context, email)
        savePhone(context, phone)
        setVerified(context, isVerified)
        saveProfilePicUrl(context, profileImageUrl)
        saveLocation(context, location)

        // 🪙 Extra Yenkasa data
        saveCoins(context, coinsBalance ?: 0)
        saveCommunityName(context, communityName)
        saveJoinDate(context, joinDate)

        Log.i(TAG, "User details batch save operation completed.")
    }

    // ✅ THIS IS THE NEW FUNCTION THAT WAS MISSING
    fun savePartialUserDetails(
        context: Context,
        username: String?,
        email: String?,
        phone: String?,
        location: String?,
        gender: String?,
        dob: String?
    ) {
        username?.let { saveUsername(context, it) }
        email?.let { saveEmail(context, it) }
        phone?.let { savePhone(context, it) }
        location?.let { saveLocation(context, it) }
        gender?.let { saveGender(context, it) }
        dob?.let { saveDob(context, it) }

        Log.i(TAG, "Partial user details saved (with gender & dob).")
    }

    // ===============================
// EMAIL / PHONE VERIFICATION
// ===============================
    fun setEmailVerified(context: Context, verified: Boolean) {
        try {
            getEncryptedPrefs(context)
                .edit()
                .putBoolean(EMAIL_VERIFIED_KEY, verified)
                .apply()
            Log.i(TAG, "📧 Email verified set to: $verified")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving email verification state", e)
        }
    }

    fun setPhoneVerified(context: Context, verified: Boolean) {
        try {
            getEncryptedPrefs(context)
                .edit()
                .putBoolean(PHONE_VERIFIED_KEY, verified)
                .apply()
            Log.i(TAG, "📱 Phone verified set to: $verified")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving phone verification state", e)
        }
    }

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

    fun clearAll(context: Context) {
        try {
            // 🔌 Disconnect socket before clearing everything
            val userId = getUserId(context)
            if (!userId.isNullOrEmpty()) {
                SocketManager.emitUserDisconnected(userId)
            }
            SocketManager.disconnect()

            getEncryptedPrefs(context).edit()
                .remove(TOKEN_KEY)
                .remove(REFRESH_KEY)
                .remove(USER_ID_KEY)
                .remove(PROFILE_PIC_KEY)
                .remove(USERNAME_KEY)
                .remove(EMAIL_KEY)
                .remove(PHONE_KEY)
                .remove(LOCATION_KEY)
                .remove(VERIFIED_KEY)
                .remove(ONE_SIGNAL_PLAYER_ID_KEY)
                .apply()

            Log.i(TAG, "All data cleared from EncryptedSharedPreferences and socket disconnected.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing all data from EncryptedSharedPreferences", e)
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

    fun saveSelectedCommunityIds(context: Context, userId: String?, communityIds: Set<String>) {
        if (userId.isNullOrBlank()) {
            Log.w(TAG, "Tried to save selected communities without a user ID. Skipping save.")
            return
        }

        try {
            getEncryptedPrefs(context)
                .edit()
                .putStringSet("$SELECTED_COMMUNITY_IDS_KEY_PREFIX$userId", communityIds.toSet())
                .apply()
            Log.i(TAG, "Selected communities saved for user: $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving selected communities to EncryptedSharedPreferences", e)
        }
    }

    fun getSelectedCommunityIds(context: Context, userId: String?): Set<String>? {
        if (userId.isNullOrBlank()) return null

        return try {
            val key = "$SELECTED_COMMUNITY_IDS_KEY_PREFIX$userId"
            val prefs = getEncryptedPrefs(context)
            if (!prefs.contains(key)) return null

            prefs.getStringSet(key, emptySet())?.toSet() ?: emptySet()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting selected communities from EncryptedSharedPreferences", e)
            null
        }
    }

    fun saveRecentPostedCommunity(context: Context, communityId: String?) {
        val cleanCommunityId = communityId?.trim().orEmpty()
        if (cleanCommunityId.isBlank()) return

        try {
            val nextIds = buildList {
                add(cleanCommunityId)
                addAll(getRecentPostedCommunityIds(context).filterNot { it == cleanCommunityId })
            }.take(MAX_RECENT_POSTED_COMMUNITIES)

            getEncryptedPrefs(context)
                .edit()
                .putString(RECENT_POSTED_COMMUNITY_IDS_KEY, nextIds.joinToString(","))
                .apply()
            Log.i(TAG, "Recent posted community saved: $cleanCommunityId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving recent posted community", e)
        }
    }

    fun getRecentPostedCommunityIds(context: Context): List<String> {
        return try {
            getEncryptedPrefs(context)
                .getString(RECENT_POSTED_COMMUNITY_IDS_KEY, null)
                ?.split(",")
                ?.map { it.trim() }
                ?.filter { it.isNotBlank() }
                ?.distinct()
                ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting recent posted communities", e)
            emptyList()
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
    fun getUser(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString("user", null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting user JSON", e)
            null
        }
    }

    private fun normalizeRole(role: String?): String {
        val normalized = role?.trim()?.lowercase()?.replace(" ", "_") ?: "unverified"
        return when (normalized) {
            "", "null" -> "unverified"
            "user" -> "unverified"
            "developer" -> "senior_developer"
            else -> normalized
        }
    }

    private fun extractRoleFromUserJson(userJson: String?): String? {
        if (userJson.isNullOrBlank()) return null
        return runCatching {
            val json = JSONObject(userJson)

            json.optString("roleName")
                .takeIf { it.isNotBlank() && it.lowercase() != "null" }
                ?.let { return@runCatching normalizeRole(it) }

            when (val roleValue = json.opt("role")) {
                is JSONObject -> {
                    roleValue.optString("name")
                        .takeIf { it.isNotBlank() && it.lowercase() != "null" }
                        ?.let { return@runCatching normalizeRole(it) }
                    roleValue.optString("roleName")
                        .takeIf { it.isNotBlank() && it.lowercase() != "null" }
                        ?.let { return@runCatching normalizeRole(it) }
                }
                is String -> {
                    roleValue.takeIf { it.isNotBlank() && it.lowercase() != "null" }
                        ?.let { return@runCatching normalizeRole(it) }
                }
            }

            if (json.optBoolean("verified", false)) "verified" else "unverified"
        }.getOrNull()
    }

    private fun syncRoleFlags(context: Context, normalizedRole: String) {
        try {
            val prefs = getEncryptedPrefs(context).edit()
            val isAdmin = normalizedRole == "admin"
            val isModerator = normalizedRole == "moderator"
            val isDeveloper = normalizedRole in listOf("junior_developer", "senior_developer")
            prefs.putBoolean(IS_ADMIN_KEY, isAdmin)
            prefs.putBoolean(IS_MODERATOR_KEY, isModerator)
            prefs.putBoolean(IS_DEVELOPER_KEY, isDeveloper)
            prefs.apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error syncing role flags", e)
        }
    }
    /**
     * ✅ Returns the normalized user's role from saved JSON first, then legacy flags.
     */
    fun getUserRole(context: Context): String {
        return try {
            extractRoleFromUserJson(getUser(context))?.also { normalizedRole ->
                syncRoleFlags(context, normalizedRole)
                return normalizedRole
            }

            when {
                isDeveloper(context) -> "senior_developer"
                isModerator(context) -> "moderator"
                isAdmin(context) -> "admin"
                isVerified(context) -> "verified"
                else -> "unverified"
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error determining user role: ${e.message}")
            "unverified"
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
        return getBoolean(context, EMAIL_VERIFIED_KEY, false)
    }

    fun isPhoneVerified(context: Context): Boolean {
        return getBoolean(context, PHONE_VERIFIED_KEY, false)
    }

    // === Coins Balance ===
    private const val COINS_KEY = "coins_balance"

    fun saveCoins(context: Context, coins: Int) {
        try {
            getEncryptedPrefs(context).edit().putInt(COINS_KEY, coins).apply()
            Log.i(TAG, "Coins balance saved: $coins")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving coins balance", e)
        }
    }

    fun getCoins(context: Context): Int {
        return try {
            getEncryptedPrefs(context).getInt(COINS_KEY, 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting coins balance", e)
            0
        }
    }

    // === Community Name ===
    private const val COMMUNITY_NAME_KEY = "community_name"

    fun saveCommunityName(context: Context, communityName: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(COMMUNITY_NAME_KEY, communityName).apply()
            Log.i(TAG, "Community name saved: $communityName")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving community name", e)
        }
    }

    fun getCommunityName(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(COMMUNITY_NAME_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting community name", e)
            null
        }
    }

    // === Join Date ===
    private const val JOIN_DATE_KEY = "join_date"

    fun saveJoinDate(context: Context, joinDate: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(JOIN_DATE_KEY, joinDate).apply()
            Log.i(TAG, "Join date saved: $joinDate")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving join date", e)
        }
    }

    fun getJoinDate(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(JOIN_DATE_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting join date", e)
            null
        }
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
    fun getUserName(context: Context): String? = getUsername(context)

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
    fun setVerified(context: Context, isVerified: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(VERIFIED_KEY, isVerified).apply()
            Log.i(TAG, "Verified status set to: $isVerified") // Changed to INFO
        } catch (e: Exception) {
            Log.e(TAG, "Error setting verified status", e)
        }
    }

    fun isVerified(context: Context): Boolean {
        return try {
            val verified = getEncryptedPrefs(context).getBoolean(VERIFIED_KEY, false)
            Log.d(TAG, "Retrieved Verified status: $verified")
            verified
        } catch (e: Exception) {
            Log.e(TAG, "Error getting verified status", e)
            false // Default to false on error
        }
    }

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




    fun setAdmin(context: Context, isAdmin: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(IS_ADMIN_KEY, isAdmin).apply()
            Log.i(TAG, "Admin status set to: $isAdmin")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting admin status", e)
        }
    }

    fun isAdmin(context: Context): Boolean {
        return try {
            getEncryptedPrefs(context).getBoolean(IS_ADMIN_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting admin status", e)
            false
        }
    }



    fun saveCommunityId(context: Context, communityId: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(COMMUNITY_ID_KEY, communityId).apply()
            Log.i(TAG, "Community ID saved: $communityId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving community ID", e)
        }
    }

    fun getCommunityId(context: Context): String? {
        return try {
            val id = getEncryptedPrefs(context).getString(COMMUNITY_ID_KEY, null)
            Log.d(TAG, "Retrieved Community ID: $id")
            id
        } catch (e: Exception) {
            Log.e(TAG, "Error getting community ID", e)
            null
        }
    }

    fun setModerator(context: Context, isModerator: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(IS_MODERATOR_KEY, isModerator).apply()
            Log.i(TAG, "Moderator status set to: $isModerator")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting moderator status", e)
        }
    }

    fun isModerator(context: Context): Boolean {
        return try {
            getEncryptedPrefs(context).getBoolean(IS_MODERATOR_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting moderator status", e)
            false
        }
    }

    fun setDeveloper(context: Context, isDeveloper: Boolean) {
        try {
            getEncryptedPrefs(context).edit().putBoolean(IS_DEVELOPER_KEY, isDeveloper).apply()
            Log.i(TAG, "Developer status set to: $isDeveloper")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting developer status", e)
        }
    }

    fun isDeveloper(context: Context): Boolean {
        return try {
            getEncryptedPrefs(context).getBoolean(IS_DEVELOPER_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error getting developer status", e)
            false
        }
    }

    fun canPost(context: Context): Boolean {
        return try {
            val userJson = getUser(context)
            if (userJson.isNullOrBlank()) {
                Log.w("CanPostCheck", "No cached user data found. Allowing UI and letting backend decide.")
                return true
            }

            val jsonObject = JSONObject(userJson)

            val suspendedUntil = jsonObject.optString("suspendedUntil", "")
            if (suspendedUntil.isNotBlank() && suspendedUntil != "null") {
                Log.w("CanPostCheck", "Cached user data has suspendedUntil=$suspendedUntil. Blocking local post access.")
                return false
            }

            Log.i("CanPostCheck", "Posting UI allowed. Backend will enforce limits and moderation.")
            true
        } catch (e: Exception) {
            Log.e("CanPostCheck", "Error checking post access. Allowing UI and letting backend decide: ${e.message}")
            true
        }
    }
    fun saveUserJson(context: Context, userJson: String) {
        try {
            getEncryptedPrefs(context).edit().putString("user", userJson).apply()
            extractRoleFromUserJson(userJson)?.let { syncRoleFlags(context, it) }
            Log.i(TAG, "🧩 Full user JSON saved successfully (${userJson.length} chars)")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving full user JSON", e)
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


    // === 🔒 BLOCKED USERS MANAGEMENT ===
    private const val BLOCKED_USERS_KEY = "blocked_users_list"

    /**
     * Save the full set of blocked user IDs.
     */
    fun saveBlockedUsers(context: Context, blockedUsers: Set<String>) {
        try {
            getEncryptedPrefs(context).edit()
                .putStringSet(BLOCKED_USERS_KEY, blockedUsers)
                .apply()
            Log.i(TAG, "🔒 Blocked users list saved (${blockedUsers.size} total).")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving blocked users list", e)
        }
    }

    /**
     * Retrieve the full list of blocked user IDs.
     */
    fun getBlockedUsers(context: Context): Set<String> {
        return try {
            getEncryptedPrefs(context).getStringSet(BLOCKED_USERS_KEY, emptySet()) ?: emptySet()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting blocked users list", e)
            emptySet()
        }
    }

    /**
     * Add one user to the blocked list.
     */
    fun addBlockedUser(context: Context, userId: String) {
        try {
            val current = getBlockedUsers(context).toMutableSet()
            current.add(userId)
            saveBlockedUsers(context, current)
            Log.i(TAG, "🚫 Added user $userId to blocked list.")
        } catch (e: Exception) {
            Log.e(TAG, "Error adding blocked user", e)
        }
    }

    // 🔥 Returns user's primary (registration) community ID
    fun getPrimaryCommunityId(context: Context): String? {
        return try {
            val id = getEncryptedPrefs(context).getString("primary_community_id", null)
            Log.d("TokenManager", "Primary community ID: $id")
            id
        } catch (e: Exception) {
            Log.e("TokenManager", "Error getting primary community ID", e)
            null
        }
    }

    // 🔥 Save it when loading user data (you will call this manually in Activities)
    fun savePrimaryCommunityId(context: Context, communityId: String?) {
        try {
            getEncryptedPrefs(context).edit().putString("primary_community_id", communityId).apply()
            Log.d("TokenManager", "Primary community saved: $communityId")
        } catch (e: Exception) {
            Log.e("TokenManager", "Error saving primary community", e)
        }
    }

    /**
     * Remove one user from the blocked list.
     */
    fun removeBlockedUser(context: Context, userId: String) {
        try {
            val current = getBlockedUsers(context).toMutableSet()
            if (current.remove(userId)) {
                saveBlockedUsers(context, current)
                Log.i(TAG, "✅ Unblocked user $userId successfully.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing blocked user", e)
        }
    }

    /**
     * Check if a user is currently blocked.
     */
    fun isUserBlocked(context: Context, userId: String): Boolean {
        return try {
            getBlockedUsers(context).contains(userId)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking blocked user", e)
            false
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

    // === 🪙 Transaction History Cache ===
    private const val TRANSACTION_HISTORY_KEY = "transaction_history_json"

    /**
     * Save transactions locally (as JSON string)
     */
    fun saveTransactionHistory(context: Context, transactions: List<TransactionUiModel>) {
        try {
            val jsonArray = org.json.JSONArray()
            for (t in transactions) {
                val obj = org.json.JSONObject().apply {
                    put("transactionId", t.transactionId)
                    put("amount", t.amount)
                    put("from", t.from)
                    put("to", t.to)
                    put("newBalance", t.newBalance)
                    put("senderUsername", t.senderUsername)
                    put("recipientUsername", t.recipientUsername)
                    put("description", t.description)
                    put("type", t.type)
                    put("createdAt", t.createdAt)
                    put("activityId", t.activityId)
                }
                jsonArray.put(obj)
            }

            getEncryptedPrefs(context).edit()
                .putString(TRANSACTION_HISTORY_KEY, jsonArray.toString())
                .apply()

            Log.i(TAG, "🪙 Cached ${transactions.size} transactions locally")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving transaction history", e)
        }
    }

    /**
     * Retrieve locally cached transactions
     */
    fun getTransactionHistory(context: Context): List<TransactionUiModel> {
        val transactions = mutableListOf<TransactionUiModel>() // 👈 FIXED LINE
        try {
            val jsonString = getEncryptedPrefs(context).getString(TRANSACTION_HISTORY_KEY, null)
            if (jsonString.isNullOrEmpty()) return transactions

            val jsonArray = org.json.JSONArray(jsonString)
            for (i in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(i)
                transactions.add(
                    TransactionUiModel(
                        transactionId = obj.optString("transactionId"),
                        amount = obj.optDouble("amount").toInt(),
                        from = obj.optString("from"),
                        to = obj.optString("to"),
                        newBalance = obj.optInt("newBalance"),
                        senderUsername = obj.optString("senderUsername"),
                        recipientUsername = obj.optString("recipientUsername"),
                        description = obj.optString("description"),
                        type = obj.optString("type"),
                        createdAt = obj.optString("createdAt"),
                        activityId = obj.optString("activityId").takeIf { it.isNotBlank() }
                    )
                )
            }
            Log.i(TAG, "✅ Loaded ${transactions.size} cached transactions")
        } catch (e: Exception) {
            Log.e(TAG, "Error reading cached transactions", e)
        }
        return transactions
    }

    // === 🌐 COMMUNITY SELECTION HELPERS ===
    fun saveSelectedCommunity(context: Context, communityId: String?, communityName: String?) {
        try {
            saveCommunityId(context, communityId)
            saveCommunityName(context, communityName)
            Log.i("TokenManager", "🏘️ Community selected: $communityName ($communityId)")
        } catch (e: Exception) {
            Log.e("TokenManager", "Error saving selected community", e)
        }
    }

    fun saveGender(context: Context, gender: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(GENDER_KEY, gender).apply()
            Log.i(TAG, "Gender saved: $gender")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving gender", e)
        }
    }

    fun getGender(context: Context): String? {
        return try {
            val gender = getEncryptedPrefs(context).getString(GENDER_KEY, null)
            Log.d(TAG, "Retrieved Gender: $gender")
            gender
        } catch (e: Exception) {
            Log.e(TAG, "Error getting gender", e)
            null
        }
    }

    fun saveDob(context: Context, dob: String?) {
        try {
            getEncryptedPrefs(context).edit().putString(DOB_KEY, dob).apply()
            Log.i(TAG, "DOB saved: $dob")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving dob", e)
        }
    }

    fun getDob(context: Context): String? {
        return try {
            val dob = getEncryptedPrefs(context).getString(DOB_KEY, null)
            Log.d(TAG, "Retrieved DOB: $dob")
            dob
        } catch (e: Exception) {
            Log.e(TAG, "Error getting dob", e)
            null
        }
    }


    fun saveDashboardCache(context: Context, json: String) {
        try {
            getEncryptedPrefs(context).edit()
                .putString(DASHBOARD_CACHE_KEY, json)
                .apply()
            Log.i("TokenManager", "📦 Dashboard cached.")
        } catch (e: Exception) {
            Log.e("TokenManager", "Error saving dashboard cache", e)
        }
    }

    fun getDashboardCache(context: Context): String? {
        return try {
            getEncryptedPrefs(context).getString(DASHBOARD_CACHE_KEY, null)
        } catch (e: Exception) {
            Log.e("TokenManager", "Error reading dashboard cache", e)
            null
        }
    }

    fun clearDashboardCache(context: Context) {
        try {
            getEncryptedPrefs(context).edit().remove(DASHBOARD_CACHE_KEY).apply()
            Log.i("TokenManager", "🧹 Dashboard cache cleared.")
        } catch (e: Exception) {
            Log.e("TokenManager", "Error clearing dashboard cache", e)
        }
    }

    fun saveFeedCache(context: Context, json: String) {
        try {
            val prefs = context.applicationContext.getSharedPreferences(FEED_CACHE_PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(FEED_CACHE_KEY, json).apply()
            Log.i(TAG, "📦 Feed cache saved.")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving feed cache", e)
        }
    }

    fun getFeedCache(context: Context): String? {
        return try {
            val prefs = context.applicationContext.getSharedPreferences(FEED_CACHE_PREF_NAME, Context.MODE_PRIVATE)
            prefs.getString(FEED_CACHE_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading feed cache", e)
            null
        }
    }

    fun saveFeedCacheCommunityNames(context: Context, names: String) {
        try {
            val prefs = context.applicationContext.getSharedPreferences(FEED_CACHE_PREF_NAME, Context.MODE_PRIVATE)
            prefs.edit().putString(FEED_CACHE_COMMUNITY_NAMES_KEY, names).apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving feed cache community names", e)
        }
    }

    fun getFeedCacheCommunityNames(context: Context): String? {
        return try {
            val prefs = context.applicationContext.getSharedPreferences(FEED_CACHE_PREF_NAME, Context.MODE_PRIVATE)
            prefs.getString(FEED_CACHE_COMMUNITY_NAMES_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading feed cache community names", e)
            null
        }
    }


    // ===============================
// FIRST LAUNCH (INTRO / GET STARTED)
// ===============================
    fun isFirstLaunch(context: Context): Boolean {
        return try {
            !getEncryptedPrefs(context)
                .getBoolean(FIRST_LAUNCH_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking first launch", e)
            true
        }
    }

    fun markFirstLaunchCompleted(context: Context) {
        try {
            getEncryptedPrefs(context)
                .edit()
                .putBoolean(FIRST_LAUNCH_KEY, true)
                .apply()
            Log.i(TAG, "🚀 First launch marked as completed")
        } catch (e: Exception) {
            Log.e(TAG, "Error marking first launch completed", e)
        }
    }

    // ===============================
// POLICIES ACCEPTANCE
// ===============================
    fun hasAcceptedPolicies(context: Context): Boolean {
        return try {
            getEncryptedPrefs(context)
                .getBoolean(POLICIES_ACCEPTED_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading policies accepted flag", e)
            false
        }
    }

    fun setPoliciesAccepted(context: Context) {
        try {
            getEncryptedPrefs(context)
                .edit()
                .putBoolean(POLICIES_ACCEPTED_KEY, true)
                .apply()
            Log.i(TAG, "📜 Policies accepted and recorded")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving policies accepted flag", e)
        }
    }


    // === Clear All ===
}
