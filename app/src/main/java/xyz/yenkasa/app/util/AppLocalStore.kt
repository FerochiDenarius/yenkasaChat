package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import xyz.yenkasa.app.model.TransactionUiModel

object AppLocalStore {
    private const val TAG = "AppLocalStore"
    private const val DASHBOARD_CACHE_KEY = "verification_dashboard_json"
    private const val FEED_CACHE_KEY = "feed_cache"
    private const val FEED_CACHE_KEY_PREFIX = "feed_cache_v2_"
    private const val FEED_SCROLL_KEY_PREFIX = "feed_scroll_v2_"
    private const val FEED_CACHE_COMMUNITY_NAMES_KEY = "feed_cache_community_names"
    private const val FIRST_LAUNCH_KEY = "first_launch_completed"
    private const val POLICIES_ACCEPTED_KEY = "policies_accepted"
    private const val BLOCKED_USERS_KEY = "blocked_users_list"
    private const val TRANSACTION_HISTORY_KEY = "transaction_history_json"

    fun saveDashboardCache(context: Context, json: String) {
        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putString(DASHBOARD_CACHE_KEY, json)
                .apply()
            Log.i(TAG, "Dashboard cache saved.")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving dashboard cache", e)
        }
    }

    fun getDashboardCache(context: Context): String? {
        return try {
            SecurePrefsStore.encryptedPrefs(context).getString(DASHBOARD_CACHE_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading dashboard cache", e)
            null
        }
    }

    fun clearDashboardCache(context: Context) {
        try {
            SecurePrefsStore.encryptedPrefs(context).edit().remove(DASHBOARD_CACHE_KEY).apply()
            Log.i(TAG, "Dashboard cache cleared.")
        } catch (e: Exception) {
            Log.e(TAG, "Error clearing dashboard cache", e)
        }
    }

    fun saveFeedCache(context: Context, json: String) {
        try {
            val saved = SecurePrefsStore.feedCachePrefs(context)
                .edit()
                .putString(FEED_CACHE_KEY, json)
                .commit()
            Log.i(TAG, "Feed cache saved. committed=$saved")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving feed cache", e)
        }
    }

    fun saveFeedCache(context: Context, cacheKey: String, json: String, updateLegacy: Boolean = true) {
        try {
            val editor = SecurePrefsStore.feedCachePrefs(context)
                .edit()
                .putString(FEED_CACHE_KEY_PREFIX + cacheKey, json)
            if (updateLegacy) editor.putString(FEED_CACHE_KEY, json)
            val saved = editor.commit()
            Log.i(TAG, "Feed cache saved. key=$cacheKey committed=$saved")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving keyed feed cache", e)
        }
    }

    fun getFeedCache(context: Context): String? {
        return try {
            SecurePrefsStore.feedCachePrefs(context).getString(FEED_CACHE_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading feed cache", e)
            null
        }
    }

    fun getFeedCache(context: Context, cacheKey: String): String? {
        return try {
            SecurePrefsStore.feedCachePrefs(context).getString(FEED_CACHE_KEY_PREFIX + cacheKey, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading keyed feed cache", e)
            null
        }
    }

    fun saveFeedScrollPosition(context: Context, cacheKey: String, position: Int) {
        try {
            SecurePrefsStore.feedCachePrefs(context)
                .edit()
                .putInt(FEED_SCROLL_KEY_PREFIX + cacheKey, position.coerceAtLeast(0))
                .apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving feed scroll position", e)
        }
    }

    fun getFeedScrollPosition(context: Context, cacheKey: String): Int {
        return try {
            SecurePrefsStore.feedCachePrefs(context).getInt(FEED_SCROLL_KEY_PREFIX + cacheKey, 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading feed scroll position", e)
            0
        }
    }

    fun saveFeedCacheCommunityNames(context: Context, names: String) {
        try {
            SecurePrefsStore.feedCachePrefs(context)
                .edit()
                .putString(FEED_CACHE_COMMUNITY_NAMES_KEY, names)
                .apply()
        } catch (e: Exception) {
            Log.e(TAG, "Error saving feed cache community names", e)
        }
    }

    fun getFeedCacheCommunityNames(context: Context): String? {
        return try {
            SecurePrefsStore.feedCachePrefs(context).getString(FEED_CACHE_COMMUNITY_NAMES_KEY, null)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading feed cache community names", e)
            null
        }
    }

    fun isFirstLaunch(context: Context): Boolean {
        return try {
            !SecurePrefsStore.encryptedPrefs(context).getBoolean(FIRST_LAUNCH_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking first launch", e)
            true
        }
    }

    fun markFirstLaunchCompleted(context: Context) {
        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putBoolean(FIRST_LAUNCH_KEY, true)
                .apply()
            Log.i(TAG, "First launch marked as completed")
        } catch (e: Exception) {
            Log.e(TAG, "Error marking first launch completed", e)
        }
    }

    fun hasAcceptedPolicies(context: Context): Boolean {
        return try {
            SecurePrefsStore.encryptedPrefs(context).getBoolean(POLICIES_ACCEPTED_KEY, false)
        } catch (e: Exception) {
            Log.e(TAG, "Error reading policies accepted flag", e)
            false
        }
    }

    fun setPoliciesAccepted(context: Context) {
        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putBoolean(POLICIES_ACCEPTED_KEY, true)
                .apply()
            Log.i(TAG, "Policies accepted and recorded")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving policies accepted flag", e)
        }
    }

    fun saveBlockedUsers(context: Context, blockedUsers: Set<String>) {
        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putStringSet(BLOCKED_USERS_KEY, blockedUsers)
                .apply()
            Log.i(TAG, "Blocked users list saved (${blockedUsers.size} total).")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving blocked users list", e)
        }
    }

    fun getBlockedUsers(context: Context): Set<String> {
        return try {
            SecurePrefsStore.encryptedPrefs(context).getStringSet(BLOCKED_USERS_KEY, emptySet()) ?: emptySet()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting blocked users list", e)
            emptySet()
        }
    }

    fun addBlockedUser(context: Context, userId: String) {
        try {
            val current = getBlockedUsers(context).toMutableSet()
            current.add(userId)
            saveBlockedUsers(context, current)
            Log.i(TAG, "Added user $userId to blocked list.")
        } catch (e: Exception) {
            Log.e(TAG, "Error adding blocked user", e)
        }
    }

    fun removeBlockedUser(context: Context, userId: String) {
        try {
            val current = getBlockedUsers(context).toMutableSet()
            if (current.remove(userId)) {
                saveBlockedUsers(context, current)
                Log.i(TAG, "Unblocked user $userId successfully.")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing blocked user", e)
        }
    }

    fun isUserBlocked(context: Context, userId: String): Boolean {
        return try {
            getBlockedUsers(context).contains(userId)
        } catch (e: Exception) {
            Log.e(TAG, "Error checking blocked user", e)
            false
        }
    }

    fun saveTransactionHistory(context: Context, transactions: List<TransactionUiModel>) {
        try {
            val jsonArray = JSONArray()
            for (transaction in transactions) {
                val obj = JSONObject().apply {
                    put("transactionId", transaction.transactionId)
                    put("amount", transaction.amount)
                    put("from", transaction.from)
                    put("to", transaction.to)
                    put("newBalance", transaction.newBalance)
                    put("senderUsername", transaction.senderUsername)
                    put("recipientUsername", transaction.recipientUsername)
                    put("description", transaction.description)
                    put("type", transaction.type)
                    put("createdAt", transaction.createdAt)
                    put("activityId", transaction.activityId)
                }
                jsonArray.put(obj)
            }

            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putString(TRANSACTION_HISTORY_KEY, jsonArray.toString())
                .apply()

            Log.i(TAG, "Cached ${transactions.size} transactions locally")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving transaction history", e)
        }
    }

    fun getTransactionHistory(context: Context): List<TransactionUiModel> {
        val transactions = mutableListOf<TransactionUiModel>()
        try {
            val jsonString = SecurePrefsStore.encryptedPrefs(context)
                .getString(TRANSACTION_HISTORY_KEY, null)
            if (jsonString.isNullOrEmpty()) return transactions

            val jsonArray = JSONArray(jsonString)
            for (index in 0 until jsonArray.length()) {
                val obj = jsonArray.getJSONObject(index)
                transactions.add(
                    TransactionUiModel(
                        transactionId = obj.optString("transactionId"),
                        amount = obj.optDouble("amount"),
                        from = obj.optString("from"),
                        to = obj.optString("to"),
                        newBalance = obj.optDouble("newBalance"),
                        senderUsername = obj.optString("senderUsername"),
                        recipientUsername = obj.optString("recipientUsername"),
                        description = obj.optString("description"),
                        type = obj.optString("type"),
                        createdAt = obj.optString("createdAt"),
                        activityId = obj.optString("activityId").takeIf { it.isNotBlank() }
                    )
                )
            }
            Log.i(TAG, "Loaded ${transactions.size} cached transactions")
        } catch (e: Exception) {
            Log.e(TAG, "Error reading cached transactions", e)
        }
        return transactions
    }
}
