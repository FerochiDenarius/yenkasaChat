package xyz.yenkasa.app.model

// ===================== Feed Models =====================

// Feed response from API
data class FeedResponse(
    val posts: List<Post>,          // list of posts
    val pagination: PaginationInfo  // pagination info
)

data class CachedFeedPayload(
    val posts: List<Post>,
    val currentPage: Int = 1,
    val isLastPage: Boolean = false,
    val cachedAt: Long = System.currentTimeMillis()
)

// Like/unlike response
data class FeedItem(
    val __isAd: Boolean = false,
    val post: Post? = null,
    val ad: AdModel? = null
)
