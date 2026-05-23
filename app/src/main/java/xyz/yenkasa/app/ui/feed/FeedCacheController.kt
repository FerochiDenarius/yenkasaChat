package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.util.Log
import com.bumptech.glide.Glide
import com.google.gson.Gson
import xyz.yenkasa.app.model.CachedFeedPayload
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.AppLocalStore
import xyz.yenkasa.app.util.CloudinaryMedia
import java.security.MessageDigest
import java.util.Locale

class FeedCacheController(
    private val context: Context,
    private val gson: Gson
) {
    fun invalidateStaleFeedStateIfNeeded() {
        val prefs = context.applicationContext.getSharedPreferences(FEED_CACHE_PREF_NAME, Context.MODE_PRIVATE)
        val expectedGeneration = currentFeedGeneration()
        val storedGeneration = prefs.getString(FEED_RENDERER_GENERATION_KEY, null)
        if (storedGeneration == expectedGeneration) return

        prefs.edit().clear().putString(FEED_RENDERER_GENERATION_KEY, expectedGeneration).apply()
        Log.i(
            "FeedCacheController",
            "feed_state_invalidated oldGeneration=$storedGeneration newGeneration=$expectedGeneration"
        )
    }

    fun cacheKeyForCommunityNames(names: List<String>): String {
        val normalized = names
            .map { it.trim().lowercase(Locale.US) }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()

        if (normalized.isEmpty()) return DEFAULT_CACHE_KEY
        val digest = MessageDigest.getInstance("SHA-256")
            .digest(normalized.joinToString("|").toByteArray())
            .joinToString("") { "%02x".format(it) }
            .take(16)
        return "communities_$digest"
    }

    fun cacheKeyForCommunityName(name: String?): String {
        val normalized = name?.trim()?.takeIf { it.isNotBlank() } ?: return DEFAULT_CACHE_KEY
        return cacheKeyForCommunityNames(listOf(normalized))
    }

    fun loadCachedFeed(
        cacheKey: String = DEFAULT_CACHE_KEY,
        allowGlobalFallback: Boolean = true,
        onLoaded: (CachedFeedPayload) -> Unit
    ): Boolean {
        val raw = AppLocalStore.getFeedCache(context, cacheKey)
            ?: if (allowGlobalFallback) AppLocalStore.getFeedCache(context) else null
            ?: run {
                Log.d("FeedCacheController", "cache_miss key=$cacheKey")
                return false
            }
        var loaded = false
        runCatching {
            gson.fromJson(raw, CachedFeedPayload::class.java)
        }.onSuccess { cached ->
            if (cached != null && cached.posts.isNotEmpty() && cached.isCompatibleWithCurrentRenderer()) {
                Log.d(
                    "FeedCacheController",
                    "cache_hit key=$cacheKey posts=${cached.posts.size} ageMs=${System.currentTimeMillis() - cached.cachedAt}"
                )
                onLoaded(cached)
                loaded = true
            } else if (cached != null && cached.posts.isNotEmpty()) {
                Log.i(
                    "FeedCacheController",
                    "cache_skipped_incompatible key=$cacheKey schema=${cached.cacheSchemaVersion} renderer=${cached.rendererVersion}"
                )
            } else {
                Log.d("FeedCacheController", "cache_empty key=$cacheKey")
            }
        }.onFailure {
            Log.w("FeedCacheController", "Failed to parse cached feed key=$cacheKey", it)
        }
        return loaded
    }

    fun saveCurrentFeedCache(
        posts: List<Post>,
        currentPage: Int,
        isLastPage: Boolean,
        cacheKey: String = DEFAULT_CACHE_KEY
    ) {
        if (posts.isEmpty()) {
            Log.d("FeedCacheController", "Skipping empty feed cache save. key=$cacheKey")
            return
        }
        runCatching {
            val payload = CachedFeedPayload(
                posts = dedupePosts(posts).take(MAX_CACHED_POSTS),
                currentPage = currentPage,
                isLastPage = isLastPage,
                cacheSchemaVersion = CACHE_VERSION,
                rendererVersion = PLAYER_RENDERER_VERSION,
                appVersionCode = currentAppVersionCode()
            )
            AppLocalStore.saveFeedCache(context, cacheKey, gson.toJson(payload))
            saveCommunitySlices(payload.posts)
            Log.d("FeedCacheController", "cache_saved key=$cacheKey posts=${payload.posts.size}")
        }.onFailure {
            Log.e("FeedCacheController", "Failed to save feed cache key=$cacheKey", it)
        }
    }

    fun preloadFeedAround(posts: List<Post>, anchorPosition: Int, fragment: androidx.fragment.app.Fragment) {
        if (!fragment.isAdded || posts.isEmpty()) return
        val start = anchorPosition.coerceAtLeast(0)
        val end = (start + PRELOAD_AHEAD_COUNT).coerceAtMost(posts.lastIndex)
        Log.d("FeedCacheController", "preload_window start=$start end=$end total=${posts.size}")
        for (index in start..end) {
            val post = posts[index]
            post.effectiveImageUrls().firstOrNull()?.let { url ->
                Glide.with(fragment).load(url).preload()
            }
            post.optimizedVideoPosterUrl()?.let { url ->
                Glide.with(fragment).load(url).preload()
            }
            post.userId.profileImage?.takeIf { it.isNotBlank() }?.let { url ->
                Glide.with(fragment)
                    .load(CloudinaryMedia.optimizedImageUrl(url, CloudinaryMedia.WIDTH_AVATAR))
                    .preload()
            }
        }
    }

    private fun saveCommunitySlices(posts: List<Post>) {
        posts.groupBy { post ->
            post.communityId?.displayName?.takeIf { it.isNotBlank() }
                ?: post.communityId?.name?.takeIf { it.isNotBlank() }
        }.forEach { (communityName, communityPosts) ->
            if (communityName.isNullOrBlank() || communityPosts.isEmpty()) return@forEach
            val key = cacheKeyForCommunityName(communityName)
            val payload = CachedFeedPayload(
                posts = dedupePosts(communityPosts).take(MAX_COMMUNITY_CACHED_POSTS),
                currentPage = 1,
                isLastPage = false,
                cacheSchemaVersion = CACHE_VERSION,
                rendererVersion = PLAYER_RENDERER_VERSION,
                appVersionCode = currentAppVersionCode()
            )
            AppLocalStore.saveFeedCache(context, key, gson.toJson(payload), updateLegacy = false)
        }
    }

    private fun dedupePosts(source: List<Post>): List<Post> {
        val seen = mutableSetOf<String>()
        return source.filter { seen.add(it._id) }
    }

    private fun CachedFeedPayload.isCompatibleWithCurrentRenderer(): Boolean {
        return cacheSchemaVersion == CACHE_VERSION &&
            rendererVersion == PLAYER_RENDERER_VERSION
    }

    private fun currentFeedGeneration(): String {
        return "$PLAYER_RENDERER_VERSION:$CACHE_VERSION"
    }

    private fun currentAppVersionCode(): Long {
        return 0L
    }

    private companion object {
        const val FEED_CACHE_PREF_NAME = "yenkasa_cache"
        const val FEED_RENDERER_GENERATION_KEY = "feed_renderer_generation"
        const val CACHE_VERSION = 3
        const val PLAYER_RENDERER_VERSION = "yenkasa_player_v3"
        const val DEFAULT_CACHE_KEY = "default"
        const val MAX_CACHED_POSTS = 100
        const val MAX_COMMUNITY_CACHED_POSTS = 60
        const val PRELOAD_AHEAD_COUNT = 1
    }
}
