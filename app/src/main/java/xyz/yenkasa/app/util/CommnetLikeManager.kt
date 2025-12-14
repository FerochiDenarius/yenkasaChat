package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log

object CommentLikeManager {
    private const val PREF_NAME = "comment_likes_cache"
    private const val KEY_LIKED_COMMENTS = "liked_comments"

    private fun getPrefs(context: Context) =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun addLikedComment(context: Context, commentId: String) {
        val set = getLikedComments(context).toMutableSet()
        set.add(commentId)
        getPrefs(context).edit().putStringSet(KEY_LIKED_COMMENTS, set).apply()
        Log.d("CommentLikeManager", "Added liked comment: $commentId")
    }

    fun removeLikedComment(context: Context, commentId: String) {
        val set = getLikedComments(context).toMutableSet()
        if (set.remove(commentId)) {
            getPrefs(context).edit().putStringSet(KEY_LIKED_COMMENTS, set).apply()
            Log.d("CommentLikeManager", "Removed liked comment: $commentId")
        }
    }

    fun getLikedComments(context: Context): Set<String> {
        return getPrefs(context).getStringSet(KEY_LIKED_COMMENTS, emptySet()) ?: emptySet()
    }

    fun isCommentLiked(context: Context, commentId: String): Boolean {
        return getLikedComments(context).contains(commentId)
    }

    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
        Log.i("CommentLikeManager", "Cleared comment likes cache")
    }
}
