package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log

object CommunityPrefsStore {
    private const val TAG = "CommunityPrefsStore"
    private const val SELECTED_COMMUNITY_IDS_KEY_PREFIX = "selected_community_ids_"
    private const val RECENT_POSTED_COMMUNITY_IDS_KEY = "recent_posted_community_ids"
    private const val PRIMARY_COMMUNITY_ID_KEY = "primary_community_id"
    private const val MAX_RECENT_POSTED_COMMUNITIES = 12

    fun saveSelectedCommunityIds(context: Context, userId: String?, communityIds: Set<String>) {
        if (userId.isNullOrBlank()) {
            Log.w(TAG, "Tried to save selected communities without a user ID. Skipping save.")
            return
        }

        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putStringSet("$SELECTED_COMMUNITY_IDS_KEY_PREFIX$userId", communityIds.toSet())
                .apply()
            Log.i(TAG, "Selected communities saved for user: $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving selected communities", e)
        }
    }

    fun getSelectedCommunityIds(context: Context, userId: String?): Set<String>? {
        if (userId.isNullOrBlank()) return null

        return try {
            val key = "$SELECTED_COMMUNITY_IDS_KEY_PREFIX$userId"
            val prefs = SecurePrefsStore.encryptedPrefs(context)
            if (!prefs.contains(key)) return null

            prefs.getStringSet(key, emptySet())?.toSet() ?: emptySet()
        } catch (e: Exception) {
            Log.e(TAG, "Error getting selected communities", e)
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

            SecurePrefsStore.encryptedPrefs(context)
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
            SecurePrefsStore.encryptedPrefs(context)
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

    fun getPrimaryCommunityId(context: Context): String? {
        return try {
            val id = SecurePrefsStore.encryptedPrefs(context)
                .getString(PRIMARY_COMMUNITY_ID_KEY, null)
            Log.d(TAG, "Primary community ID: $id")
            id
        } catch (e: Exception) {
            Log.e(TAG, "Error getting primary community ID", e)
            null
        }
    }

    fun savePrimaryCommunityId(context: Context, communityId: String?) {
        try {
            SecurePrefsStore.encryptedPrefs(context)
                .edit()
                .putString(PRIMARY_COMMUNITY_ID_KEY, communityId)
                .apply()
            Log.d(TAG, "Primary community saved: $communityId")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving primary community", e)
        }
    }
}
