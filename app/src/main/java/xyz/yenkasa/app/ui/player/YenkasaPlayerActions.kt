package xyz.yenkasa.app.ui.player

import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post

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
    fun onCreateSponsoredAd()
    fun onCommunitySelected(community: Community?)
    fun onSeeAllCommunities()
    fun onShowPostOptions(post: Post)
    fun onNavigateTo(position: Int)
}
