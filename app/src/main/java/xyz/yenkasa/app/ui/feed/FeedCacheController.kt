package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.util.Log
import com.bumptech.glide.Glide
import com.google.gson.Gson
import xyz.yenkasa.app.model.CachedFeedPayload
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.util.TokenManager

class FeedCacheController(
    private val context: Context,
    private val gson: Gson
) {
    fun loadCachedFeed(onLoaded: (CachedFeedPayload) -> Unit): Boolean {
        val raw = TokenManager.getFeedCache(context) ?: return false
        var loaded = false
        runCatching {
            gson.fromJson(raw, CachedFeedPayload::class.java)
        }.onSuccess { cached ->
            if (cached != null && cached.posts.isNotEmpty()) {
                onLoaded(cached)
                loaded = true
            }
        }.onFailure {
            Log.w("FeedCacheController", "Failed to parse cached feed", it)
        }
        return loaded
    }

    fun saveCurrentFeedCache(posts: List<Post>, currentPage: Int, isLastPage: Boolean) {
        if (posts.isEmpty()) {
            Log.d("FeedCacheController", "Skipping empty feed cache save.")
            return
        }
        runCatching {
            val payload = CachedFeedPayload(
                posts = posts.take(MAX_CACHED_POSTS),
                currentPage = currentPage,
                isLastPage = isLastPage
            )
            TokenManager.saveFeedCache(context, gson.toJson(payload))
        }.onFailure {
            Log.e("FeedCacheController", "Failed to save feed cache", it)
        }
    }

    fun preloadFeedAround(posts: List<Post>, anchorPosition: Int, fragment: androidx.fragment.app.Fragment) {
        if (!fragment.isAdded || posts.isEmpty()) return
        val start = anchorPosition.coerceAtLeast(0)
        val end = (start + 5).coerceAtMost(posts.lastIndex)
        for (index in start..end) {
            val post = posts[index]
            post.effectiveImageUrls().firstOrNull()?.let { url ->
                Glide.with(fragment).load(url).preload()
            }
            post.videoUrl?.takeIf { it.isNotBlank() }?.let { url ->
                Glide.with(fragment).load(url).preload()
            }
            post.userId.profileImage?.takeIf { it.isNotBlank() }?.let { url ->
                Glide.with(fragment).load(url).preload()
            }
        }
    }

    private companion object {
        const val MAX_CACHED_POSTS = 60
    }
}
