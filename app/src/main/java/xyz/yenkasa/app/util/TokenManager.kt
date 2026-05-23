package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log
import org.json.JSONObject
import xyz.yenkasa.app.network.SocketManager

object TokenManager {
    private const val TOKEN_KEY = "auth_token"
    private const val REFRESH_KEY = "refresh_token"
    private const val USER_ID_KEY = "userId"
    private const val PROFILE_PIC_KEY = "profile_pic_url"
    private const val USERNAME_KEY = "username"
    private const val EMAIL_KEY = "email"
    private const val PHONE_KEY = "phone"
    private const val LOCATION_KEY = "location"
    private const val VERIFIED_KEY = "is_verified"
    private const val ONE_SIGNAL_PLAYER_ID_KEY = "one_signal_player_id"
    private const val IS_ADMIN_KEY = "is_admin"
    private const val IS_MODERATOR_KEY = "is_moderator"
    private const val IS_DEVELOPER_KEY = "is_developer"
    private const val COMMUNITY_ID_KEY = "community_id"
    private const val TAG = "TokenManager"
    private const val GENDER_KEY = "user_gender"
    private const val DOB_KEY = "user_dob"
    private const val EMAIL_VERIFIED_KEY = "email_verified"
    private const val PHONE_VERIFIED_KEY = "phone_verified"

    private fun getEncryptedPrefs(context: Context) = SecurePrefsStore.encryptedPrefs(context)

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
        val normalized = role?.trim()?.lowercase()?.replace(Regex("[\\s-]+"), "_") ?: "unverified"
        return when (normalized) {
            "", "null" -> "unverified"
            "user" -> "unverified"
            "developer" -> "senior_developer"
            "senior_dev", "super_admin", "superadmin" -> "senior_developer"
            "junior_dev" -> "junior_developer"
            "verified_creator" -> "verified"
            else -> normalized
        }
    }

    private fun strongestPublicRole(json: JSONObject): String? {
        val publicRoles = json.optJSONArray("publicRoles") ?: return null
        val roles = mutableSetOf<String>()
        for (index in 0 until publicRoles.length()) {
            roles.add(normalizeRole(publicRoles.optString(index)))
        }

        val priority = listOf(
            "campus_influencer",
            "premium_seller",
            "business_account",
            "brand_ambassador",
            "top_vendor",
            "legend",
            "rising_star",
            "verified"
        )
        return priority.firstOrNull { roles.contains(it) }
    }

    private fun extractRoleFromUserJson(userJson: String?): String? {
        if (userJson.isNullOrBlank()) return null
        return runCatching {
            val json = JSONObject(userJson)

            json.optString("staffRole")
                .takeIf { it.isNotBlank() && it.lowercase() != "null" }
                ?.let { return@runCatching normalizeRole(it) }

            strongestPublicRole(json)?.let { return@runCatching it }

            json.optString("accessRole")
                .takeIf { it.isNotBlank() && it.lowercase() != "null" }
                ?.let { return@runCatching normalizeRole(it) }

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
    private const val COINS_PRECISE_KEY = "coins_balance_precise"

    fun saveCoins(context: Context, coins: Int) {
        try {
            getEncryptedPrefs(context).edit()
                .putInt(COINS_KEY, coins)
                .putFloat(COINS_PRECISE_KEY, coins.toFloat())
                .apply()
            Log.i(TAG, "Coins balance saved: $coins")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving coins balance", e)
        }
    }

    fun saveCoinsPrecise(context: Context, coins: Double) {
        try {
            getEncryptedPrefs(context).edit()
                .putInt(COINS_KEY, coins.toInt())
                .putFloat(COINS_PRECISE_KEY, coins.toFloat())
                .apply()
            Log.i(TAG, "Precise coins balance saved: $coins")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving precise coins balance", e)
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

    fun getCoinsPrecise(context: Context): Double {
        return try {
            val prefs = getEncryptedPrefs(context)
            if (prefs.contains(COINS_PRECISE_KEY)) {
                prefs.getFloat(COINS_PRECISE_KEY, 0f).toDouble()
            } else {
                prefs.getInt(COINS_KEY, 0).toDouble()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting precise coins balance", e)
            0.0
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
            runCatching {
                val json = JSONObject(userJson)
                json.optString("username").takeIf { it.isNotBlank() }?.let { saveUsername(context, it) }
                json.optString("profileImage").takeIf { it.isNotBlank() }?.let { saveProfilePicUrl(context, it) }
                if (json.has("coinsBalance")) {
                    saveCoinsPrecise(context, json.optDouble("coinsBalance", getCoinsPrecise(context)))
                }
            }.onFailure {
                Log.w(TAG, "Saved user JSON but could not sync cached identity fields: ${it.message}")
            }
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
}
