package xyz.yenkasa.app.ui.feed

import android.content.Intent
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.PagerSnapHelper
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.AdBinder
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.ui.ads.AdEligibilityManager
import xyz.yenkasa.app.ui.ads.MonetizationAdDialog
import xyz.yenkasa.app.ui.ads.MonetizationAdRequest
import xyz.yenkasa.app.ui.ads.MonetizationAdType
import xyz.yenkasa.app.ui.CoinWalletActivity
import xyz.yenkasa.app.ui.CreateAdActivity
import xyz.yenkasa.app.ui.StartLiveActivity
import xyz.yenkasa.app.ui.MenuActivity
import xyz.yenkasa.app.ui.player.YenkasaPlayerActions
import xyz.yenkasa.app.ui.player.YenkasaPlayerFeedAdapter
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions

class FeedPlayerCoordinator(
    private val fragment: Fragment,
    private val recyclerView: RecyclerView,
    private val layoutManager: LinearLayoutManager,
    private val callbacks: Callbacks,
    private val shouldLoadNextPage: () -> Boolean,
    private val onLoadNextPage: () -> Unit,
    private val onViewCountUpdated: (String, Int) -> Unit
) {
    data class Callbacks(
        val onOpenProfile: (String) -> Unit,
        val onLike: (Post, Int) -> Unit,
        val onComment: (Post, Int) -> Unit,
        val onShare: (Post) -> Unit,
        val onSave: (Post, Boolean) -> Unit,
        val onReward: (Post) -> Unit,
        val onMoreOptions: (Post) -> Unit,
        val onLiveArenaClick: () -> Unit,
        val onLiveStreamClick: () -> Unit,
        val onCommunitySelected: (Community?) -> Unit,
        val onSeeAllCommunities: () -> Unit,
        val onFeedModeSelected: (FeedTabsController.FeedMode) -> Unit
    )

    private val snapHelper = PagerSnapHelper()
    private val playerAdapter = YenkasaPlayerFeedAdapter(
        fragment.requireContext(),
        createPlayerActions(),
        onViewCountUpdated,
        AdBinder(fragment.requireContext())
    )
    private var sponsoredAds: List<AdModel> = emptyList()
    private var monetizationDialogShowing = false

    fun setup() {
        AdEligibilityManager.init(fragment.requireContext())
        recyclerView.stopScroll()
        recyclerView.adapter = null
        recyclerView.recycledViewPool.clear()
        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = playerAdapter
        recyclerView.itemAnimator = null
        snapHelper.attachToRecyclerView(recyclerView)
        recyclerView.addOnLayoutChangeListener { view, _, _, _, _, _, _, _, _ ->
            playerAdapter.setViewportHeight(view.height)
        }
        recyclerView.post {
            playerAdapter.setViewportHeight(recyclerView.height)
        }
        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                if (dy > 0 && shouldLoadNextPage()) {
                    val lastVisible = layoutManager.findLastVisibleItemPosition()
                    if (lastVisible >= layoutManager.itemCount - 3) {
                        onLoadNextPage()
                    }
                }
            }

            override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                if (newState == RecyclerView.SCROLL_STATE_IDLE) {
                    handleSnapToActiveItem()
                } else {
                    pauseActive()
                }
            }
        })
    }

    fun submitPosts(posts: List<Post>) {
        playerAdapter.submitPosts(posts)
    }

    fun submitItems(items: List<Any>) {
        playerAdapter.submitItems(items)
    }

    fun resetRenderedState() {
        playerAdapter.releaseAll(recyclerView)
        playerAdapter.resetTransientState()
        recyclerView.recycledViewPool.clear()
    }

    fun pauseActive() {
        playerAdapter.pauseActive(recyclerView)
    }

    fun resumeActive() {
        playerAdapter.resumeActive(recyclerView)
    }

    fun releaseAll() {
        playerAdapter.releaseAll(recyclerView)
        snapHelper.attachToRecyclerView(null)
    }

    fun setCommunities(communities: List<Community>, selectedIds: Set<String>) {
        playerAdapter.updateCommunities(communities, selectedIds)
    }

    fun setFeedMode(mode: FeedTabsController.FeedMode) {
        playerAdapter.updateFeedMode(mode)
    }

    fun setMonetizationAds(ads: List<AdModel>) {
        sponsoredAds = ads.filter { !it.videoUrl.isNullOrBlank() }
    }

    fun handleSnapToActiveItem() {
        val snapView = snapHelper.findSnapView(layoutManager) ?: return
        val position = recyclerView.getChildAdapterPosition(snapView)
        if (position != RecyclerView.NO_POSITION) {
            playerAdapter.setActivePosition(recyclerView, position)
        }
    }

    private fun createPlayerActions(): YenkasaPlayerActions {
        return object : YenkasaPlayerActions {
            override fun onOpenMenu() {
                fragment.startActivity(Intent(fragment.requireContext(), MenuActivity::class.java))
            }

            override fun onOpenProfile(userId: String) {
                callbacks.onOpenProfile(userId)
            }

            override fun onLike(post: Post, position: Int) {
                callbacks.onLike(post, position)
            }

            override fun onComment(post: Post, position: Int) {
                AdEligibilityManager.setTyping(fragment.requireContext(), true)
                callbacks.onComment(post, position)
            }

            override fun onShare(post: Post) {
                callbacks.onShare(post)
            }

            override fun onSave(post: Post, saved: Boolean) {
                playerAdapter.setPostSaved(post._id, saved)
                callbacks.onSave(post, saved)
            }

            override fun onReward(post: Post) {
                if (monetizationDialogShowing) return
                val context = fragment.requireContext()
                val ad = pickMonetizationAd(post, MonetizationAdType.REWARDED) ?: run {
                    callbacks.onReward(post)
                    return
                }
                monetizationDialogShowing = true
                playerAdapter.pauseActive(recyclerView)
                if (AdEligibilityManager.shouldRegisterMonetizedSession(context)) {
                    AdEligibilityManager.registerMonetizedSession(context)
                }
                MonetizationAdDialog.show(
                    fragment = fragment,
                    request = MonetizationAdRequest(
                        ad = ad,
                        placement = MonetizationAdType.REWARDED,
                        rewardEligible = true,
                        postId = post._id
                    )
                ) { outcome ->
                    AdEligibilityManager.registerAdShown(context, MonetizationAdType.REWARDED, post._id)
                    if (!outcome.completed) {
                        AdEligibilityManager.registerAdSkipped(context, MonetizationAdType.REWARDED, post._id)
                    }
                    monetizationDialogShowing = false
                    if (fragment.isAdded) {
                        playerAdapter.resumeActive(recyclerView)
                    }
                }
            }

            override fun onOpenWallet() {
                fragment.startActivity(Intent(fragment.requireContext(), CoinWalletActivity::class.java))
            }

            override fun onOpenLiveArena() {
                callbacks.onLiveArenaClick()
            }

            override fun onOpenLiveStream() {
                callbacks.onLiveStreamClick()
            }

            override fun onCreateSponsoredAd() {
                val role = TokenManager.getUserRole(fragment.requireContext())
                if (TokenManager.isVerified(fragment.requireContext()) || UserPermissions.canCreateAd(role)) {
                    fragment.startActivity(Intent(fragment.requireContext(), CreateAdActivity::class.java))
                } else {
                    Toast.makeText(
                        fragment.requireContext(),
                        R.string.ad_creation_approved_creators_only,
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onCommunitySelected(community: Community?) {
                callbacks.onCommunitySelected(community)
            }

            override fun onSeeAllCommunities() {
                callbacks.onSeeAllCommunities()
            }

            override fun onShowPostOptions(post: Post) {
                callbacks.onMoreOptions(post)
            }

            override fun onSearchQuery(query: String) {
                AdEligibilityManager.setTyping(fragment.requireContext(), query.isNotBlank())
                Toast.makeText(
                    fragment.requireContext(),
                    fragment.getString(R.string.search_query, query),
                    Toast.LENGTH_SHORT
                ).show()
            }

            override fun onFeedModeSelected(mode: FeedTabsController.FeedMode) {
                callbacks.onFeedModeSelected(mode)
            }

            override fun onMonetizationProgress(post: Post, currentSeconds: Int, durationSeconds: Int) {
                handleMonetizationProgress(post, currentSeconds, durationSeconds)
            }

            override fun onNavigateTo(position: Int) {
                if (position in 0 until playerAdapter.itemCount) {
                    recyclerView.smoothScrollToPosition(position)
                }
            }
        }
    }

    private fun handleMonetizationProgress(post: Post, currentSeconds: Int, durationSeconds: Int) {
        val context = fragment.requireContext()
        if (monetizationDialogShowing || !fragment.isAdded) return

        if (currentSeconds >= 10) {
            AdEligibilityManager.registerVideoWatched(context, post._id)
        }

        if (durationSeconds > 60 && currentSeconds in 40..60) {
            if (AdEligibilityManager.canShowMidRoll(context, post._id, durationSeconds)) {
                showMonetizationAd(MonetizationAdType.MIDROLL, post, rewardEligible = false)
                return
            }
        }

        if (currentSeconds >= 12 && AdEligibilityManager.canShowInterstitial(context, post._id)) {
            showMonetizationAd(MonetizationAdType.INTERSTITIAL, post, rewardEligible = false)
        }
    }

    private fun showMonetizationAd(
        type: MonetizationAdType,
        post: Post,
        rewardEligible: Boolean
    ) {
        if (monetizationDialogShowing) return
        val ad = pickMonetizationAd(post, type) ?: return
        monetizationDialogShowing = true
        playerAdapter.pauseActive(recyclerView)
        if (AdEligibilityManager.shouldRegisterMonetizedSession(fragment.requireContext())) {
            AdEligibilityManager.registerMonetizedSession(fragment.requireContext())
        }
        MonetizationAdDialog.show(
            fragment = fragment,
            request = MonetizationAdRequest(
                ad = ad,
                placement = type,
                rewardEligible = rewardEligible,
                postId = post._id
            )
        ) { outcome ->
            AdEligibilityManager.registerAdShown(fragment.requireContext(), type, post._id)
            if (!outcome.completed) {
                AdEligibilityManager.registerAdSkipped(fragment.requireContext(), type, post._id)
            }
            monetizationDialogShowing = false
            if (fragment.isAdded) {
                playerAdapter.resumeActive(recyclerView)
            }
        }
    }

    private fun pickMonetizationAd(post: Post, type: MonetizationAdType): AdModel? {
        val available = sponsoredAds
        if (available.isEmpty()) return null
        val index = "${post._id}:${type.name}".hashCode().ushr(1) % available.size
        return available[index]
    }
}
