package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.util.Log
import com.bumptech.glide.Glide
import com.google.gson.Gson
import xyz.yenkasa.app.model.CachedFeedPayload
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.CloudinaryMedia
import xyz.yenkasa.app.util.TokenManager
import java.security.MessageDigest
import java.util.Locale

class FeedCacheController(
    private val context: Context,
    private val gson: Gson
) {
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
        val raw = TokenManager.getFeedCache(context, cacheKey)
            ?: if (allowGlobalFallback) TokenManager.getFeedCache(context) else null
            ?: run {
                Log.d("FeedCacheController", "cache_miss key=$cacheKey")
                return false
            }
        var loaded = false
        runCatching {
            gson.fromJson(raw, CachedFeedPayload::class.java)
        }.onSuccess { cached ->
            if (cached != null && cached.posts.isNotEmpty()) {
                Log.d(
                    "FeedCacheController",
                    "cache_hit key=$cacheKey posts=${cached.posts.size} ageMs=${System.currentTimeMillis() - cached.cachedAt}"
                )
                onLoaded(cached)
                loaded = true
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
                isLastPage = isLastPage
            )
            TokenManager.saveFeedCache(context, cacheKey, gson.toJson(payload))
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
                isLastPage = false
            )
            TokenManager.saveFeedCache(context, key, gson.toJson(payload), updateLegacy = false)
        }
    }

    private fun dedupePosts(source: List<Post>): List<Post> {
        val seen = mutableSetOf<String>()
        return source.filter { seen.add(it._id) }
    }

    private companion object {
        const val DEFAULT_CACHE_KEY = "default"
        const val MAX_CACHED_POSTS = 100
        const val MAX_COMMUNITY_CACHED_POSTS = 60
        const val PRELOAD_AHEAD_COUNT = 1
    }
}
