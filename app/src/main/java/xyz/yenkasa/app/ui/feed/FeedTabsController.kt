package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.graphics.Typeface
import android.widget.TextView
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post

class FeedTabsController(
    private val context: Context
) {
    enum class FeedMode {
        FOR_YOU,
        FOLLOWING,
        TRENDING,
        TOP,
        LATEST,
        POPULAR
    }

    var selectedTabId: Int = R.id.tabForYou
        private set
    var selectedMode: FeedMode = FeedMode.FOR_YOU
        private set

    fun selectMode(mode: FeedMode) {
        selectedMode = mode
        selectedTabId = tabIdFromMode(mode)
    }

    fun bindTabs(tabs: List<TextView>, onModeChanged: (FeedMode) -> Unit) {
        tabs.forEach { tab ->
            tab.setOnClickListener {
                selectedTabId = tab.id
                selectedMode = modeFromTabId(tab.id)
                updateTabVisualState(tabs)
                onModeChanged(selectedMode)
            }
        }
        updateTabVisualState(tabs)
    }

    fun applyFeedMode(sourcePosts: List<Post>, followingUserIds: Set<String>?): List<Post> {
        return when (selectedMode) {
            FeedMode.FOR_YOU -> sourcePosts.sortedByDescending { personalizedScore(it) }
            FeedMode.FOLLOWING -> {
                val ids = followingUserIds.orEmpty()
                sourcePosts
                    .filter { ids.contains(it.userId.id) }
                    .sortedByDescending { FeedTimeUtils.parsePostTimestampMillis(it.createdAt) ?: 0L }
            }
            FeedMode.TRENDING -> sourcePosts.sortedByDescending { trendingScore(it) }
            FeedMode.TOP -> sourcePosts.sortedByDescending { topScore(it) }
            FeedMode.LATEST -> sourcePosts.sortedByDescending {
                FeedTimeUtils.parsePostTimestampMillis(it.createdAt) ?: 0L
            }
            FeedMode.POPULAR -> sourcePosts.sortedByDescending { popularScore(it) }
        }
    }

    private fun updateTabVisualState(tabs: List<TextView>) {
        tabs.forEach { tab ->
            val selected = tab.id == selectedTabId
            tab.setTextColor(
                ContextCompat.getColor(
                    context,
                    if (selected) R.color.feed_accent else R.color.feed_secondary_text
                )
            )
            tab.setTypeface(null, if (selected) Typeface.BOLD else Typeface.NORMAL)
            tab.setBackgroundResource(
                if (selected) R.drawable.bg_feed_tab_selected else R.drawable.bg_feed_tab_unselected
            )
        }
    }

    private fun modeFromTabId(tabId: Int): FeedMode {
        return when (tabId) {
            R.id.tabFollowing -> FeedMode.FOLLOWING
            R.id.tabTrending -> FeedMode.TRENDING
            R.id.tabLatest -> FeedMode.LATEST
            R.id.tabTop -> FeedMode.TOP
            else -> FeedMode.FOR_YOU
        }
    }

    private fun tabIdFromMode(mode: FeedMode): Int {
        return when (mode) {
            FeedMode.FOLLOWING -> R.id.tabFollowing
            FeedMode.TRENDING -> R.id.tabTrending
            FeedMode.LATEST -> R.id.tabLatest
            FeedMode.TOP -> R.id.tabTop
            else -> R.id.tabForYou
        }
    }

    private fun personalizedScore(post: Post): Double {
        val recencyHours = ageHours(post)
        val engagement = post.likeCount +
            (post.commentCount * 2) +
            (post.shareCount * 3) +
            (post.viewCount / 12.0) +
            (post.coinsEarned * 2)
        return engagement + (12.0 / recencyHours)
    }

    private fun trendingScore(post: Post): Double {
        val recencyHours = ageHours(post)
        val momentum = post.likeCount +
            (post.commentCount * 2.5) +
            (post.shareCount * 4) +
            (post.viewCount / 8.0) +
            (post.coinsEarned * 3)
        return momentum / recencyHours
    }

    private fun topScore(post: Post): Double {
        return post.likeCount +
            (post.commentCount * 2.0) +
            (post.shareCount * 4.0) +
            (post.viewCount / 6.0) +
            (post.coinsEarned * 3.5)
    }

    private fun popularScore(post: Post): Double {
        return post.likeCount +
            (post.commentCount * 2.0) +
            (post.shareCount * 3.0) +
            (post.viewCount / 10.0) +
            post.saveCount +
            (post.coinsEarned * 2.0)
    }

    private fun ageHours(post: Post): Double {
        val createdAt = FeedTimeUtils.parsePostTimestampMillis(post.createdAt) ?: return 24.0
        val diffMs = (System.currentTimeMillis() - createdAt).coerceAtLeast(1L)
        return (diffMs / 3_600_000.0).coerceAtLeast(1.0)
    }
}
