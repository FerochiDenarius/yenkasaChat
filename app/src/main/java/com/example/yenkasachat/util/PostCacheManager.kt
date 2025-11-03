package com.example.yenkasachat.util

import android.content.Context
import android.content.SharedPreferences
import com.example.yenkasachat.model.Post
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object PostCacheManager {
    private const val PREF_NAME = "post_cache_prefs"
    private const val POSTS_KEY = "cached_posts"

    private fun getPrefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    // ✅ Save posts (after fetching from backend)
    fun savePosts(context: Context, posts: List<Post>) {
        try {
            val json = Gson().toJson(posts)
            getPrefs(context).edit().putString(POSTS_KEY, json).apply()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    // ✅ Retrieve cached posts (for offline or quick load)
    fun getCachedPosts(context: Context): List<Post>? {
        return try {
            val json = getPrefs(context).getString(POSTS_KEY, null)
            if (json != null) {
                val type = object : TypeToken<List<Post>>() {}.type
                Gson().fromJson(json, type)
            } else null
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    // ✅ Clear cached posts
    fun clearCache(context: Context) {
        getPrefs(context).edit().remove(POSTS_KEY).apply()
    }
}
