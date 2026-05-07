package xyz.yenkasa.app.ui

import android.animation.ValueAnimator
import android.app.AlertDialog
import android.content.BroadcastReceiver
import android.content.Context
import android.content.DialogInterface
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.graphics.Typeface
import android.os.Bundle
import android.os.Build
import android.util.Log
import android.view.*
import android.widget.*
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.bumptech.glide.Glide
import com.google.gson.Gson
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.FeedAdapter
import xyz.yenkasa.app.adapter.FeedCommunityStoryAdapter
import xyz.yenkasa.app.adapter.CommunityStoryPreview
import xyz.yenkasa.app.model.*
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.adapter.AdBinder
import xyz.yenkasa.app.ui.feed.FeedCacheController
import xyz.yenkasa.app.ui.feed.FeedChromeController
import xyz.yenkasa.app.ui.feed.FeedCommunityController
import xyz.yenkasa.app.ui.feed.FeedNetworkController
import xyz.yenkasa.app.ui.feed.FeedPlayerCoordinator
import xyz.yenkasa.app.ui.feed.FeedPostActionsController
import xyz.yenkasa.app.ui.feed.FeedSocketController
import xyz.yenkasa.app.ui.feed.FeedTabsController
import xyz.yenkasa.app.ui.feed.FeedTimeUtils
import xyz.yenkasa.app.work.FeedSyncWorker
import java.text.SimpleDateFormat
import java.text.NumberFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit


class FeedFragment : Fragment() {
    companion object {
        const val USE_YENKASA_PLAYER_VIEW = true
        private const val FEED_AD_INTERVAL = 4
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var footerProgressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var offlineBanner: TextView
    private lateinit var communityNameView: TextView
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var fabYenkasaLive: FloatingActionButton
    private lateinit var selectedCommunitiesText: TextView
    private lateinit var communitiesBar: View
    private lateinit var feedFilterBar: View
    private lateinit var communityStoryRecyclerView: RecyclerView
    private lateinit var feedTabs: List<TextView>
    private lateinit var floatingWalletViews: FeedChromeController.FloatingWalletViews

    private val posts = mutableListOf<Post>()
    private lateinit var feedAdapter: FeedAdapter
    private var playerCoordinator: FeedPlayerCoordinator? = null
    private lateinit var communityStoryAdapter: FeedCommunityStoryAdapter

    private lateinit var layoutManager: LinearLayoutManager

    private var token: String? = null
    private var userId: String? = null
    private var currentPage = 1
    private var isLoading = false
    private var isLoadingMore = false
    private var isLastPage = false
    private var hasShownCachedFeed = false
    private var feedRequestGeneration = 0
    private var activeCacheKey = "default"
    private var lastLoadedPostId: String? = null
    private val restoredScrollCacheKeys = mutableSetOf<String>()
    private var followingUserIds: Set<String>? = null
    private var sponsoredAds: List<AdModel> = emptyList()
    private var communitiesBarHidden = false
    private var communitiesBarNaturalHeight = 0
    private var communitiesBarAnimator: ValueAnimator? = null
    private var walletReceiverRegistered = false

    private lateinit var tabsController: FeedTabsController
    private lateinit var communityController: FeedCommunityController
    private lateinit var networkController: FeedNetworkController
    private lateinit var postActionsController: FeedPostActionsController
    private lateinit var socketController: FeedSocketController
    private lateinit var cacheController: FeedCacheController
    private lateinit var chromeController: FeedChromeController

    private val selectedFeedMode: FeedTabsController.FeedMode
        get() = tabsController.selectedMode
    private val allCommunities: List<Community>
        get() = communityController.allCommunities
    private val selectedCommunities: MutableSet<Community>
        get() = communityController.selectedCommunities
    private val communityStoryPreviews: Map<String, CommunityStoryPreview>
        get() = communityController.communityStoryPreviews

    private val walletBalanceReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action != WalletBalanceManager.ACTION_BALANCE_UPDATED) return
            val newBalance = intent.getDoubleExtra(
                WalletBalanceManager.EXTRA_BALANCE_DOUBLE,
                chromeController.currentWalletBalance
            )
            chromeController.updateFloatingWalletBalance(
                newBalance = newBalance,
                animate = newBalance > chromeController.currentWalletBalance,
                walletViews = floatingWalletViews
            )
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.feed_fragment, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        initAuth()
        initViews(view)
        initControllers()
        chromeController.setupInitialChrome(
            walletViews = floatingWalletViews,
            fabYenkasaLive = fabYenkasaLive,
            communityStoryRecyclerView = communityStoryRecyclerView,
            recyclerView = recyclerView,
            communitiesBar = communitiesBar,
            feedFilterBar = feedFilterBar,
            mainAppBar = requireActivity().findViewById(R.id.mainAppBar),
            fabCreatePost = fabCreatePost,
            usePlayerChrome = USE_YENKASA_PLAYER_VIEW,
            userIdProvider = { userId },
            onFeedFocusRequested = { recyclerView.smoothScrollToPosition(0) }
        )
        setupRecyclerView()
        communityStoryAdapter = communityController.setupStoryRecyclerView(
            recyclerView = communityStoryRecyclerView,
            onAllCommunitiesClick = {
                communityController.handleSelectAllCommunities(
                    onNoCommunities = { openCommunitySelectorOrToast() },
                    onSelectionChanged = { syncCommunitySelectionUi() },
                    onFeedReloadRequested = { reloadFeedFromStart() }
                )
            },
            onCommunityClick = { community ->
                communityController.handleSelectCommunity(
                    community = community,
                    onSelectionChanged = { syncCommunitySelectionUi() },
                    onFeedReloadRequested = { reloadFeedFromStart() }
                )
            }
        )
        setupFeedTabs()
        setupInfiniteScroll()
        loadCachedFeed()
        scheduleBackgroundFeedSync()
        setupNetworkMonitoring()

        loadSponsoredAds()
        recyclerView.post {
            communityController.fetchCommunitiesAndSelection(
                onSelectionReady = {
                    communityController.loadCommunityStoryPreviews {
                        communityController.updateCommunityStoryRow(
                            if (::communityStoryAdapter.isInitialized) communityStoryAdapter else null
                        )
                    }
                    reloadFeedFromStart()
                },
                onSelectionChanged = { syncCommunitySelectionUi() }
            )
        }
        trackDailyLogin()

        socketController.connect(userId)
    }

    private fun initControllers() {
        tabsController = FeedTabsController(requireContext())
        communityController = FeedCommunityController(
            requireContext(),
            tokenProvider = { token },
            userIdProvider = { userId }
        )
        networkController = FeedNetworkController(this)
        cacheController = FeedCacheController(requireContext(), Gson())
        postActionsController = FeedPostActionsController(
            fragment = this,
            tokenProvider = { token },
            postsProvider = { posts },
            onPostsChanged = { renderPosts() },
            onCacheChanged = { saveCurrentFeedCache() }
        )
        socketController = FeedSocketController(
            lifecycleScope = viewLifecycleOwner.lifecycleScope,
            postsProvider = { posts },
            onPostsChanged = { renderPosts() },
            onCacheChanged = { saveCurrentFeedCache() },
            onScrollToTop = { recyclerView.scrollToPosition(0) },
            onViewCountUpdated = { postId, viewsCount ->
                updateSourcePostViewCount(postId, viewsCount)
                if (!USE_YENKASA_PLAYER_VIEW) {
                    feedAdapter.updatePostViewCount(postId, viewsCount)
                } else {
                    renderPosts()
                }
            }
        )
        chromeController = FeedChromeController(this)
    }

    private fun initAuth() {
        token = TokenManager.getToken(requireContext())
        userId = TokenManager.getUserId(requireContext())

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(requireContext(), "Please log in again.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }
    }

    private fun initViews(view: View) {
        recyclerView = view.findViewById(R.id.recyclerViewFeed)
        progressBar = view.findViewById(R.id.progressBarFeed)
        footerProgressBar = view.findViewById(R.id.progressBarFeedFooter)
        emptyView = view.findViewById(R.id.textEmptyFeed)
        offlineBanner = view.findViewById(R.id.textOfflineBanner)
        communityNameView = view.findViewById(R.id.textCommunityNameHeader)
        fabCreatePost = requireActivity().findViewById(R.id.fabCreatePost)
        fabYenkasaLive = requireActivity().findViewById(R.id.btnYenkasaLive)
        communitiesBar = view.findViewById(R.id.layoutFeedCommunitiesBar)
        feedFilterBar = view.findViewById(R.id.feedFilterBar)
        selectedCommunitiesText = view.findViewById(R.id.textSelectedCommunities)
        communityStoryRecyclerView = view.findViewById(R.id.recyclerViewFeedCommunities)
        floatingWalletViews = FeedChromeController.FloatingWalletViews(
            walletCard = view.findViewById(R.id.floatingWalletCard),
            coinContainer = view.findViewById(R.id.floatingWalletCoinContainer),
            coinView = view.findViewById(R.id.imageFloatingWalletCoin),
            balanceView = view.findViewById(R.id.textFloatingWalletBalance),
            deltaView = view.findViewById(R.id.textFloatingWalletDelta),
            sparklesView = view.findViewById(R.id.layoutFloatingWalletSparkles),
            dropViews = listOf(
                view.findViewById(R.id.imageFloatingWalletDropOne),
                view.findViewById(R.id.imageFloatingWalletDropTwo),
                view.findViewById(R.id.imageFloatingWalletDropThree)
            )
        )
        feedTabs = listOf(
            view.findViewById(R.id.tabForYou),
            view.findViewById(R.id.tabFollowing),
            view.findViewById(R.id.tabTrending),
            view.findViewById(R.id.tabTop)
        )

        communitiesBar.post {
            communitiesBarNaturalHeight = communitiesBar.height
        }
    }


    private fun setupRecyclerView() {
        layoutManager = LinearLayoutManager(requireContext())

        if (USE_YENKASA_PLAYER_VIEW) {
            playerCoordinator = FeedPlayerCoordinator(
                fragment = this,
                recyclerView = recyclerView,
                layoutManager = layoutManager,
                callbacks = createPlayerCallbacks(),
                shouldLoadNextPage = { !isLoading && !isLoadingMore && !isLastPage },
                onLoadNextPage = { loadFeed(currentPage + 1) },
                onViewCountUpdated = { postId, viewsCount -> updateSourcePostViewCount(postId, viewsCount) }
            ).also { it.setup() }
            return
        }

        feedAdapter = FeedAdapter(
            requireContext(),
            onLikeClick = { post, position -> postActionsController.handleLike(post, position) },
            onCommentClick = { post, _ -> postActionsController.openComments(post) },
            onUserClick = { id -> postActionsController.openUserProfile(id) },
            onPostClick = { post ->
                when {
                    !post.videoUrl.isNullOrEmpty() || !post.audioUrl.isNullOrEmpty() || post.effectiveImageUrls().isNotEmpty() ->
                        postActionsController.openMedia(post)
                }
            },
            onShareClick = { post -> postActionsController.sharePost(post) },
            onViewCountUpdated = { postId, viewsCount ->
                updateSourcePostViewCount(postId, viewsCount)
            },
            adAdapterCallbacks = AdBinder(requireContext())
        )
// 🔥 CONNECT POST OPTIONS (delete / hide / flag / download)
        feedAdapter.onDelete = { post ->
            postActionsController.confirmDeletePost(post)
        }

        feedAdapter.onHide = { post ->
            postActionsController.hidePost(post)
        }

        feedAdapter.onFlag = { post ->
            postActionsController.flagPost(post)
        }

        feedAdapter.onDownload = { post ->
            postActionsController.downloadPost(post)
        }

        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = feedAdapter
    }

    private fun createPlayerCallbacks(): FeedPlayerCoordinator.Callbacks {
        return FeedPlayerCoordinator.Callbacks(
            onOpenProfile = { id -> postActionsController.openUserProfile(id) },
            onLike = { post, position -> postActionsController.handleLike(post, position) },
            onComment = { post, _ -> postActionsController.openComments(post) },
            onShare = { post -> postActionsController.sharePost(post) },
            onSave = { _, _ -> },
            onReward = { startActivity(Intent(requireContext(), CoinWalletActivity::class.java)) },
            onMoreOptions = { post -> postActionsController.showPostOptionsBottomSheet(post) },
            onLiveArenaClick = { chromeController.showLiveSheet() },
            onCommunitySelected = { community -> selectPlayerCommunity(community) },
            onSeeAllCommunities = { openCommunitySelectorOrToast() },
            onFeedModeSelected = { mode -> selectPlayerFeedMode(mode) }
        )
    }

    private fun selectPlayerFeedMode(mode: FeedTabsController.FeedMode) {
        tabsController.selectMode(mode)
        playerCoordinator?.setFeedMode(mode)
        reloadFeedFromStart()
    }

    private fun selectPlayerCommunity(community: Community?) {
        if (community == null) {
            communityController.handleSelectAllCommunities(
                onNoCommunities = { openCommunitySelectorOrToast() },
                onSelectionChanged = { syncCommunitySelectionUi() },
                onFeedReloadRequested = { reloadFeedFromStart() }
            )
        } else {
            communityController.handleSelectCommunity(
                community = community,
                onSelectionChanged = { syncCommunitySelectionUi() },
                onFeedReloadRequested = { reloadFeedFromStart() }
            )
        }
    }

    private fun setupInfiniteScroll() {
        if (USE_YENKASA_PLAYER_VIEW) return

        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(recyclerView, dx, dy)
                updateCommunitiesBarForScroll(recyclerView, dy)
                if (dy <= 0) return

                val lastVisible = layoutManager.findLastVisibleItemPosition()
                val totalItemCount = layoutManager.itemCount
                preloadFeedAround(lastVisible)

                if (!isLoading && !isLoadingMore && !isLastPage && lastVisible >= totalItemCount - 3) {
                    loadFeed(currentPage + 1)
                }
            }

            override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                super.onScrollStateChanged(recyclerView, newState)
                if (newState != RecyclerView.SCROLL_STATE_IDLE) return

                val first = layoutManager.findFirstVisibleItemPosition()
                val last = layoutManager.findLastVisibleItemPosition()
                if (first == RecyclerView.NO_POSITION || last == RecyclerView.NO_POSITION) return

                val center = (first + last) / 2
                feedAdapter.autoPlayCenteredVideo(recyclerView, center)
            }
        })
    }

    private fun updateCommunitiesBarForScroll(recyclerView: RecyclerView, dy: Int) {
        if (!::communitiesBar.isInitialized) return

        if (!recyclerView.canScrollVertically(-1)) {
            showCommunitiesBar()
            return
        }

        when {
            dy > 10 -> hideCommunitiesBar()
            dy < -10 -> showCommunitiesBar()
        }
    }

    private fun hideCommunitiesBar() {
        if (communitiesBarHidden || communitiesBar.height == 0) return

        val startHeight = communitiesBar.height
        communitiesBarNaturalHeight = maxOf(communitiesBarNaturalHeight, startHeight)
        communitiesBarHidden = true
        communitiesBarAnimator?.cancel()

        communitiesBarAnimator = ValueAnimator.ofInt(startHeight, 0).apply {
            duration = 200
            addUpdateListener { animator ->
                val height = animator.animatedValue as Int
                val progress = if (communitiesBarNaturalHeight == 0) 0f else height.toFloat() / communitiesBarNaturalHeight
                communitiesBar.layoutParams = communitiesBar.layoutParams.apply {
                    this.height = height
                }
                communitiesBar.translationY = -(communitiesBarNaturalHeight - height).toFloat()
                communitiesBar.alpha = progress
            }
            start()
        }
    }

    private fun showCommunitiesBar() {
        val targetHeight = communitiesBarNaturalHeight.takeIf { it > 0 }
            ?: (communityStoryRecyclerView.height + selectedCommunitiesText.height).takeIf { it > 0 }
            ?: return

        if (!communitiesBarHidden && communitiesBar.height == targetHeight && communitiesBar.alpha == 1f) return

        communitiesBarHidden = false
        communitiesBarAnimator?.cancel()

        communitiesBarAnimator = ValueAnimator.ofInt(communitiesBar.height, targetHeight).apply {
            duration = 200
            addUpdateListener { animator ->
                val height = animator.animatedValue as Int
                val progress = height.toFloat() / targetHeight
                communitiesBar.layoutParams = communitiesBar.layoutParams.apply {
                    this.height = height
                }
                communitiesBar.translationY = -(targetHeight - height).toFloat()
                communitiesBar.alpha = progress
            }
            start()
        }
    }

    private fun setupFeedTabs() {
        tabsController.bindTabs(feedTabs) {
            currentPage = 1
            isLastPage = false
            reloadFeedFromStart()
        }
    }


    private fun buildMixedFeed(posts: List<Post>): List<Any> {
        val mixed = mutableListOf<Any>()
        var counter = 0

        for (post in posts) {
            mixed.add(post)
            counter++

            if (counter % FEED_AD_INTERVAL == 0) {
                val adIndex = (counter / FEED_AD_INTERVAL) - 1
                val ad = sponsoredAds.getOrNull(adIndex % sponsoredAds.size.coerceAtLeast(1))
                Log.d(
                    "YenkasaAds",
                    "insert ad after organicCount=$counter mixedIndex=${mixed.size} source=${ad?.sponsorName ?: "AdMob fallback"}"
                )
                mixed.add(
                    ad ?: AdModel(
                        _id = "local-ad-${counter}",
                        sponsorName = "AdMob",
                        adType = "google",
                        title = "Sponsored Ad",
                        imageUrl = null,
                        videoUrl = null,
                        thumbnailUrl = null,
                        ctaUrl = null,
                        ctaText = "Learn More",
                        rewardYKC = 0
                    )
                )
            }
        }

        Log.d("YenkasaAds", "buildMixedFeed posts=${posts.size} items=${mixed.size} ads=${mixed.count { it is AdModel }}")
        return mixed
    }

    private fun loadSponsoredAds() {
        val authToken = token ?: return
        ApiClient.apiService.getSponsoredAds("Bearer $authToken")
            .enqueue(object : Callback<AdsFeedResponse> {
                override fun onResponse(
                    call: Call<AdsFeedResponse>,
                    response: Response<AdsFeedResponse>
                ) {
                    val ads = response.body()?.ads.orEmpty()
                    sponsoredAds = if (response.isSuccessful) ads else emptyList()
                    if (::feedAdapter.isInitialized && posts.isNotEmpty()) {
                        val mixedFeed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixedFeed)
                        if (USE_YENKASA_PLAYER_VIEW) {
                            playerCoordinator?.submitItems(mixedFeed)
                        }
                    }
                }

                override fun onFailure(call: Call<AdsFeedResponse>, t: Throwable) {
                    Log.w("FeedFragment", "Sponsored ads unavailable, using AdMob fallback: ${t.message}")
                    sponsoredAds = emptyList()
                    if (USE_YENKASA_PLAYER_VIEW && posts.isNotEmpty()) {
                        playerCoordinator?.submitItems(buildMixedFeed(posts))
                    }
                }
            })
    }


    private fun loadFeed(page: Int = 1) {
        if (isLoading) {
            Log.d("FeedFragment", "feed_request_skipped loading=true page=$page")
            return
        }

        if (selectedFeedMode == FeedTabsController.FeedMode.FOLLOWING && followingUserIds == null) {
            fetchFollowingUserIds { loadFeed(page) }
            return
        }

        val names = selectedCommunityNames()
        val cacheKey = cacheController.cacheKeyForCommunityNames(names)

        if (!isOnline()) {
            updateOfflineBanner(true)
            val loaded = if (page <= 1) {
                loadCachedFeed(cacheKey, replace = posts.isEmpty(), allowGlobalFallback = posts.isEmpty())
            } else {
                false
            }
            Log.d("FeedFragment", "offline_recovery page=$page cacheKey=$cacheKey loaded=$loaded posts=${posts.size}")
            updateEmptyFeedUi(isRefreshing = posts.isEmpty())
            return
        } else {
            updateOfflineBanner(false)
        }

        isLoading = true
        isLoadingMore = page > 1
        showLoading(true, page <= 1)

        if (names.isEmpty()) {
            if (posts.isEmpty()) {
                loadCachedFeed(cacheKey, replace = true, allowGlobalFallback = true)
            } else {
                renderPosts()
            }
            isLoading = false
            isLoadingMore = false
            showLoading(false, page <= 1)
            updateEmptyFeedUi(isRefreshing = posts.isEmpty())
            return
        }

        val namesString = names.joinToString(",")
        TokenManager.saveFeedCacheCommunityNames(requireContext(), namesString)
        val requestGeneration = feedRequestGeneration
        val requestStartedAt = System.currentTimeMillis()
        val previousPostsForSameFeed = if (activeCacheKey == cacheKey) posts.toList() else emptyList()
        Log.d(
            "FeedFragment",
            "feed_fetch_start page=$page cacheKey=$cacheKey names=${names.size} previous=${previousPostsForSameFeed.size}"
        )

        ApiClient.apiService.getPostsByCommunities(
            "Bearer $token",
            namesString,
            page,
            20
        ).enqueue(object : Callback<FeedResponse> {

            override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                if (requestGeneration != feedRequestGeneration) {
                    Log.d("FeedFragment", "feed_fetch_ignored_stale page=$page cacheKey=$cacheKey")
                    return
                }
                isLoading = false
                isLoadingMore = false
                showLoading(false, page <= 1)

                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    val sourcePosts = body.posts
                    communityController.mergeCommunityStoryPreviews(sourcePosts)
                    communityController.updateCommunityStoryRow(
                        if (::communityStoryAdapter.isInitialized) communityStoryAdapter else null
                    )
                    val filteredPosts = tabsController.applyFeedMode(sourcePosts, followingUserIds)

                    if (page == 1) {
                        posts.clear()
                        posts.addAll(mergeRefreshPosts(filteredPosts, previousPostsForSameFeed))
                    } else {
                        posts.addAll(mergeUniquePosts(posts, filteredPosts))
                    }

                    activeCacheKey = cacheKey
                    currentPage = page
                    isLastPage = body.pagination.currentPage >= body.pagination.totalPages || filteredPosts.isEmpty()
                    lastLoadedPostId = posts.lastOrNull()?._id
                    Log.d(
                        "FeedFragment",
                        "feed_fetch_success page=$page received=${sourcePosts.size} rendered=${posts.size} hasMore=${!isLastPage} lastLoadedPostId=$lastLoadedPostId durationMs=${System.currentTimeMillis() - requestStartedAt}"
                    )
                    renderPosts()
                    restoreScrollPositionIfNeeded(cacheKey)
                    saveCurrentFeedCache()
                } else {
                    val loaded = if (posts.isEmpty()) {
                        loadCachedFeed(cacheKey, replace = true, allowGlobalFallback = true)
                    } else {
                        false
                    }
                    Log.w("FeedFragment", "feed_fetch_failed code=${response.code()} cacheLoaded=$loaded")
                    updateEmptyFeedUi(isRefreshing = posts.isEmpty())
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                if (requestGeneration != feedRequestGeneration) {
                    Log.d("FeedFragment", "feed_failure_ignored_stale page=$page cacheKey=$cacheKey")
                    return
                }
                isLoading = false
                isLoadingMore = false
                showLoading(false, page <= 1)
                Log.e("FeedFragment", "feed_fetch_failure page=$page cacheKey=$cacheKey message=${t.message}")
                if (posts.isEmpty()) {
                    loadCachedFeed(cacheKey, replace = true, allowGlobalFallback = true)
                }
                updateEmptyFeedUi(isRefreshing = posts.isEmpty())
            }
        })
    }

    private fun fetchFollowingUserIds(onComplete: () -> Unit) {
        val currentUserId = userId
        val authToken = token

        if (currentUserId.isNullOrBlank() || authToken.isNullOrBlank()) {
            followingUserIds = emptySet()
            onComplete()
            return
        }

        ApiClient.apiService.getFollowing(currentUserId, "Bearer $authToken")
            .enqueue(object : Callback<FollowListResponse> {
                override fun onResponse(
                    call: Call<FollowListResponse>,
                    response: Response<FollowListResponse>
                ) {
                    followingUserIds = response.body()
                        ?.following
                        ?.map { it._id }
                        ?.toSet()
                        .orEmpty()
                    onComplete()
                }

                override fun onFailure(call: Call<FollowListResponse>, t: Throwable) {
                    followingUserIds = emptySet()
                    onComplete()
                }
            })
    }

    private fun trackDailyLogin() {
        ApiClient.apiService.trackLogin("Bearer $token").enqueue(object : Callback<TrackLoginResponse> {
            override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) {}
            override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                Log.e("FeedFragment", "Login track failed: ${t.message}")
            }
        })
    }

    private fun showLoading(show: Boolean, isFirstPage: Boolean) {
        progressBar.visibility = if (show && isFirstPage && posts.isEmpty()) View.VISIBLE else View.GONE
        footerProgressBar.visibility = if (show && !isFirstPage && posts.isNotEmpty()) View.VISIBLE else View.GONE
        if (isFirstPage) updateEmptyFeedUi(isRefreshing = show && posts.isEmpty())
    }

    private fun updateSourcePostViewCount(postId: String, viewsCount: Int) {
        val index = posts.indexOfFirst { it._id == postId }
        if (index >= 0) {
            posts[index] = posts[index].copy(viewCount = viewsCount)
        }
    }

    override fun onResume() {
        super.onResume()
        updateOfflineBanner(!isOnline())
        chromeController.onHostResume(floatingWalletViews)
        WalletBalanceManager.refreshBalance(requireContext())
        if (USE_YENKASA_PLAYER_VIEW) {
            playerCoordinator?.resumeActive()
        }
    }

    override fun onPause() {
        super.onPause()
        saveCurrentScrollPosition()
        chromeController.onHostPause()
        if (USE_YENKASA_PLAYER_VIEW) {
            playerCoordinator?.pauseActive()
        } else {
            feedAdapter.pauseAllVideos()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        chromeController.detach()
        if (USE_YENKASA_PLAYER_VIEW) {
            playerCoordinator?.releaseAll()
            playerCoordinator = null
            chromeController.restoreMainChrome(
                mainAppBar = requireActivity().findViewById(R.id.mainAppBar),
                fabYenkasaLive = fabYenkasaLive
            )
        } else {
            feedAdapter.pauseAllVideos()
        }
        socketController.detach()
        networkController.tearDown()
    }

    override fun onStart() {
        super.onStart()
        if (!walletReceiverRegistered) {
            ContextCompat.registerReceiver(
                requireContext(),
                walletBalanceReceiver,
                IntentFilter(WalletBalanceManager.ACTION_BALANCE_UPDATED),
                ContextCompat.RECEIVER_NOT_EXPORTED
            )
            walletReceiverRegistered = true
        }
    }

    override fun onStop() {
        if (walletReceiverRegistered) {
            requireContext().unregisterReceiver(walletBalanceReceiver)
            walletReceiverRegistered = false
        }
        super.onStop()
    }

    private fun renderPosts() {
        if (USE_YENKASA_PLAYER_VIEW) {
            playerCoordinator?.setFeedMode(selectedFeedMode)
            playerCoordinator?.submitItems(buildMixedFeed(posts))
            playerCoordinator?.setCommunities(
                allCommunities,
                selectedCommunities.mapNotNull { it.id }.toSet()
            )
            updateEmptyFeedUi(isRefreshing = isLoading && posts.isEmpty())
            if (posts.isNotEmpty()) {
                preloadFeedAround(layoutManager.findFirstVisibleItemPosition().coerceAtLeast(0))
                recyclerView.post {
                    playerCoordinator?.handleSnapToActiveItem()
                }
            }
            return
        }

        feedAdapter.updateItems(buildMixedFeed(posts))
        updateEmptyFeedUi(isRefreshing = isLoading && posts.isEmpty())
        if (posts.isNotEmpty()) {
            preloadFeedAround(layoutManager.findFirstVisibleItemPosition().coerceAtLeast(0))
        }
    }

    private fun mergeUniquePosts(existing: List<Post>, incoming: List<Post>): List<Post> {
        val existingIds = existing.map { it._id }.toMutableSet()
        return incoming.filter { existingIds.add(it._id) }
    }

    private fun mergeRefreshPosts(fresh: List<Post>, cachedOrExisting: List<Post>): List<Post> {
        if (fresh.isEmpty()) return emptyList()
        val seen = mutableSetOf<String>()
        return (fresh + cachedOrExisting).filter { seen.add(it._id) }
    }

    private fun syncCommunitySelectionUi() {
        communityController.applySelectionToUi(
            selectedCommunitiesText = selectedCommunitiesText,
            communityNameView = communityNameView,
            communityStoryAdapter = if (::communityStoryAdapter.isInitialized) communityStoryAdapter else null,
            onPlayerCommunitiesUpdated = { communities, selectedIds ->
                playerCoordinator?.setCommunities(communities, selectedIds)
            }
        )
    }

    private fun openCommunitySelectorOrToast() {
        communityController.openCommunitySelector(
            onNoCommunities = {
                Toast.makeText(requireContext(), "No communities found.", Toast.LENGTH_SHORT).show()
            },
            onSelectionChanged = { syncCommunitySelectionUi() },
            onFeedReloadRequested = { reloadFeedFromStart() }
        )
    }

    private fun reloadFeedFromStart() {
        feedRequestGeneration++
        isLoading = false
        isLoadingMore = false
        currentPage = 1
        isLastPage = false
        val cacheKey = cacheController.cacheKeyForCommunityNames(selectedCommunityNames())
        loadCachedFeed(
            cacheKey = cacheKey,
            replace = true,
            allowGlobalFallback = posts.isEmpty()
        )
        loadFeed()
    }

    private fun loadCachedFeed(
        cacheKey: String = activeCacheKey,
        replace: Boolean = true,
        allowGlobalFallback: Boolean = true
    ): Boolean {
        return cacheController.loadCachedFeed(cacheKey, allowGlobalFallback) { cached ->
            if (replace || posts.isEmpty()) {
                posts.clear()
                posts.addAll(cached.posts)
                activeCacheKey = cacheKey
                currentPage = cached.currentPage.coerceAtLeast(1)
                isLastPage = cached.isLastPage
                lastLoadedPostId = posts.lastOrNull()?._id
                hasShownCachedFeed = true
                renderPosts()
                restoreScrollPositionIfNeeded(cacheKey)
            }
        }
    }

    private fun saveCurrentFeedCache() {
        cacheController.saveCurrentFeedCache(posts, currentPage, isLastPage, activeCacheKey)
    }

    private fun preloadFeedAround(anchorPosition: Int) {
        cacheController.preloadFeedAround(posts, anchorPosition, this)
    }

    private fun saveCurrentScrollPosition() {
        if (!::layoutManager.isInitialized) return
        val position = layoutManager.findFirstVisibleItemPosition()
        if (position == RecyclerView.NO_POSITION) return
        TokenManager.saveFeedScrollPosition(requireContext(), activeCacheKey, position)
        Log.d("FeedFragment", "feed_scroll_saved key=$activeCacheKey position=$position")
    }

    private fun restoreScrollPositionIfNeeded(cacheKey: String) {
        if (!restoredScrollCacheKeys.add(cacheKey)) return
        val position = TokenManager.getFeedScrollPosition(requireContext(), cacheKey)
        if (position <= 0 || posts.isEmpty()) return
        recyclerView.post {
            val bounded = position.coerceAtMost((recyclerView.adapter?.itemCount ?: posts.size) - 1)
            if (bounded > 0) {
                recyclerView.scrollToPosition(bounded)
                Log.d("FeedFragment", "feed_scroll_restored key=$cacheKey position=$bounded")
            }
        }
    }

    private fun updateEmptyFeedUi(isRefreshing: Boolean) {
        if (!::emptyView.isInitialized) return
        updatePlayerEmptyRecoveryChrome(posts.isEmpty())
        emptyView.text = when {
            isRefreshing -> "Refreshing feed..."
            selectedCommunities.isNotEmpty() -> "No posts in this community yet. Choose another community."
            else -> "No posts yet."
        }
        emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun updatePlayerEmptyRecoveryChrome(show: Boolean) {
        if (!USE_YENKASA_PLAYER_VIEW || !::communitiesBar.isInitialized) return
        val visibility = if (show) View.VISIBLE else View.GONE
        communitiesBar.visibility = visibility
        feedFilterBar.visibility = visibility
        floatingWalletViews.walletCard.visibility = visibility
        fabYenkasaLive.visibility = visibility
        val mainAppBar: View? = requireActivity().findViewById(R.id.mainAppBar)
        mainAppBar?.visibility = visibility
    }

    private fun updateOfflineBanner(isOffline: Boolean) {
        if (!::offlineBanner.isInitialized) return
        networkController.updateOfflineBanner(offlineBanner, isOffline)
    }

    private fun isOnline(): Boolean {
        return networkController.isOnline()
    }

    private fun selectedCommunityNames(): List<String> {
        return selectedCommunities.mapNotNull { it.displayName ?: it.name }
    }

    private fun setupNetworkMonitoring() {
        networkController.setupNetworkMonitoring(
            offlineBanner = offlineBanner,
            shouldReload = { posts.isEmpty() || hasShownCachedFeed },
            onReload = { loadFeed(1) }
        )
    }

    private fun scheduleBackgroundFeedSync() {
        networkController.scheduleBackgroundFeedSync()
    }

}
