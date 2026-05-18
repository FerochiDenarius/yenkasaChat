package xyz.yenkasa.app.ui.player

import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.ui.feed.FeedTabsController

interface YenkasaPlayerActions {
    fun onOpenMenu()
    fun onOpenProfile(userId: String)
    fun onLike(post: Post, position: Int)
    fun onComment(post: Post, position: Int)
    fun onShare(post: Post)
    fun onSave(post: Post, saved: Boolean)
    fun onReward(post: Post)
    fun onOpenWallet()
    fun onOpenLiveArena()
    fun onOpenLiveStream()
    fun onCreateSponsoredAd()
    fun onCommunitySelected(community: Community?)
    fun onSeeAllCommunities()
    fun onShowPostOptions(post: Post)
    fun onNavigateTo(position: Int)
    fun onSearchQuery(query: String)
    fun onFeedModeSelected(mode: FeedTabsController.FeedMode)
    fun onMonetizationProgress(post: Post, currentSeconds: Int, durationSeconds: Int)
}
