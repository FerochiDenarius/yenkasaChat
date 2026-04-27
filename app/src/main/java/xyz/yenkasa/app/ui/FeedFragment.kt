package xyz.yenkasa.app.ui

import android.app.AlertDialog
import android.content.DialogInterface
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.util.Log
import android.view.*
import android.widget.*
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.FeedAdapter
import xyz.yenkasa.app.adapter.FeedCommunityStoryAdapter
import xyz.yenkasa.app.adapter.CommunityStoryPreview
import xyz.yenkasa.app.model.*
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.adapter.AdBinder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone


class FeedFragment : Fragment() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var communityNameView: TextView
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var selectedCommunitiesText: TextView
    private lateinit var communityStoryRecyclerView: RecyclerView
    private lateinit var feedTabs: List<TextView>

    private val posts = mutableListOf<Post>()
    private lateinit var feedAdapter: FeedAdapter
    private lateinit var communityStoryAdapter: FeedCommunityStoryAdapter

    private lateinit var layoutManager: LinearLayoutManager

    private var token: String? = null
    private var userId: String? = null
    private var currentPage = 1
    private var isLoading = false
    private var selectedFeedTabId = R.id.tabForYou
    private var selectedFeedMode = FeedMode.FOR_YOU
    private var followingUserIds: Set<String>? = null
    private var communityStoryPreviews: Map<String, CommunityStoryPreview> = emptyMap()
    private var sponsoredAds: List<AdModel> = emptyList()

    private var allCommunities: List<Community> = emptyList()
    private val selectedCommunities = mutableSetOf<Community>()

    private enum class FeedMode {
        FOR_YOU,
        FOLLOWING,
        TRENDING,
        TOP
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
        setupRecyclerView()
        setupCommunityStoryRecyclerView()
        setupFeedTabs()

        loadSponsoredAds()
        recyclerView.post { fetchCommunitiesAndFeed() }
        trackDailyLogin()

        fabCreatePost.isEnabled = true
        fabCreatePost.alpha = 1f
        fabCreatePost.setOnClickListener {
            val intent = Intent(requireContext(), PostActivity::class.java)
            intent.putExtra("userId", userId)
            startActivity(intent)
        }

        SocketManager.ensureConnected(userId)
        setupSocketListeners()
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
        emptyView = view.findViewById(R.id.textEmptyFeed)
        communityNameView = view.findViewById(R.id.textCommunityNameHeader)
        fabCreatePost = requireActivity().findViewById(R.id.fabCreatePost)
        selectedCommunitiesText = view.findViewById(R.id.textSelectedCommunities)
        communityStoryRecyclerView = view.findViewById(R.id.recyclerViewFeedCommunities)
        feedTabs = listOf(
            view.findViewById(R.id.tabForYou),
            view.findViewById(R.id.tabFollowing),
            view.findViewById(R.id.tabTrending),
            view.findViewById(R.id.tabTop)
        )
    }


    private fun setupRecyclerView() {
        layoutManager = LinearLayoutManager(requireContext())

        feedAdapter = FeedAdapter(
            requireContext(),
            onLikeClick = { post, position ->
                val context = requireContext()
                val token = TokenManager.getToken(context)

                if (!token.isNullOrEmpty()) {
                    FeedUtils.toggleLike(context, token, post) { liked, newLikeCount ->
                        val updatedPost = post.copy(
                            likedByUser = liked,
                            likeCount = newLikeCount
                        )
                        posts[position] = updatedPost

                        val mixed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixed)
                    }
                }
            },
            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { id -> openUserProfile(id) },
            onPostClick = { post ->
                when {
                    !post.videoUrl.isNullOrEmpty() -> openVideo(post)
                    !post.audioUrl.isNullOrEmpty() -> openAudio(post)
                }
            },
            onShareClick = { post -> sharePost(post) },
            onViewCountUpdated = { postId, viewsCount ->
                updateSourcePostViewCount(postId, viewsCount)
            },
            adAdapterCallbacks = AdBinder(requireContext())
        )
// 🔥 CONNECT POST OPTIONS (delete / hide / flag / download)
        feedAdapter.onDelete = { post ->
            confirmDeletePost(post)
        }

        feedAdapter.onHide = { post ->
            hidePost(post)
        }

        feedAdapter.onFlag = { post ->
            flagPost(post)
        }

        feedAdapter.onDownload = { post ->
            downloadPost(post)
        }

        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = feedAdapter
    }

    private fun setupCommunityStoryRecyclerView() {
        communityStoryAdapter = FeedCommunityStoryAdapter(
            onAllCommunitiesClick = { selectAllCommunitiesFromStory() },
            onCommunityClick = { community -> selectCommunityFromStory(community) }
        )

        communityStoryRecyclerView.layoutManager =
            LinearLayoutManager(requireContext(), LinearLayoutManager.HORIZONTAL, false)
        communityStoryRecyclerView.adapter = communityStoryAdapter
    }

    private fun setupFeedTabs() {
        feedTabs.forEach { tab ->
            tab.setOnClickListener {
                selectedFeedTabId = tab.id
                selectedFeedMode = when (tab.id) {
                    R.id.tabFollowing -> FeedMode.FOLLOWING
                    R.id.tabTrending -> FeedMode.TRENDING
                    R.id.tabTop -> FeedMode.TOP
                    else -> FeedMode.FOR_YOU
                }
                updateFeedTabVisualState()
                currentPage = 1
                loadFeed()
            }
        }
        updateFeedTabVisualState()
    }

    private fun updateFeedTabVisualState() {
        feedTabs.forEach { tab ->
            val selected = tab.id == selectedFeedTabId
            tab.setTextColor(
                ContextCompat.getColor(
                    requireContext(),
                    if (selected) R.color.feed_accent else R.color.feed_secondary_text
                )
            )
            tab.setTypeface(null, if (selected) Typeface.BOLD else Typeface.NORMAL)
            tab.setBackgroundResource(
                if (selected) R.drawable.bg_feed_tab_selected else R.drawable.bg_feed_tab_unselected
            )
        }
    }

    private fun openImage(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.effectiveImageUrls().firstOrNull())
        intent.putExtra("MEDIA_TYPE", "image")
        intent.putExtra("POST_ID", post._id)
        intent.putExtra("USERNAME", post.userId.username)
        intent.putExtra("CAPTION", post.caption ?: "")
        startActivity(intent)
    }

    private fun openVideo(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.videoUrl)
        intent.putExtra("MEDIA_TYPE", "video")
        intent.putExtra("POST_ID", post._id)
        intent.putExtra("USERNAME", post.userId.username)
        intent.putExtra("CAPTION", post.caption ?: "")
        startActivity(intent)
    }


    private fun openAudio(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.audioUrl)
        intent.putExtra("MEDIA_TYPE", "audio")
        intent.putExtra("POST_ID", post._id)
        intent.putExtra("USERNAME", post.userId.username)
        intent.putExtra("CAPTION", post.caption ?: "")
        startActivity(intent)
    }


    private fun sharePost(post: Post) {
        token?.takeIf { it.isNotBlank() }?.let { authToken ->
            ApiClient.apiService.recordPostShare(post._id, "Bearer $authToken")
                .enqueue(object : Callback<GenericResponse> {
                    override fun onResponse(
                        call: Call<GenericResponse>,
                        response: Response<GenericResponse>
                    ) {
                        if (!response.isSuccessful) {
                            Log.w("FeedFragment", "Failed to record share for ${post._id}: ${response.code()}")
                        }
                    }

                    override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                        Log.w("FeedFragment", "Failed to record share for ${post._id}: ${t.message}")
                    }
                })
        }

        val shareIntent = Intent(Intent.ACTION_SEND)
        shareIntent.type = "text/plain"
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
        shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
        startActivity(Intent.createChooser(shareIntent, "Share via"))
    }


    private fun fetchCommunitiesAndFeed() {
        val auth = "Bearer $token"

        ApiClient.apiService.getCommunities(auth)
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fallbackCommunity()
                        return
                    }

                    allCommunities = response.body()!!
                    loadCommunityStoryPreviews()
                    fetchUserMembership()
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    fallbackCommunity()
                }
            })
    }


    private fun buildMixedFeed(posts: List<Post>): List<Any> {
        val mixed = mutableListOf<Any>()
        var counter = 0

        for (post in posts) {
            mixed.add(post)
            counter++

            if (counter % 5 == 0) {
                val adIndex = (counter / 5) - 1
                val ad = sponsoredAds.getOrNull(adIndex % sponsoredAds.size.coerceAtLeast(1))
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
                        feedAdapter.updateItems(buildMixedFeed(posts))
                    }
                }

                override fun onFailure(call: Call<AdsFeedResponse>, t: Throwable) {
                    Log.w("FeedFragment", "Sponsored ads unavailable, using AdMob fallback: ${t.message}")
                    sponsoredAds = emptyList()
                }
            })
    }


    private fun fetchUserMembership() {
        val auth = "Bearer $token"

        ApiClient.apiService.getUserPrimaryCommunity(auth)
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    fetchJoinedCommunities(response.body()?.community)
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    fetchJoinedCommunities(null)
                }
            })
    }

    private fun fetchJoinedCommunities(primary: Community?) {
        val auth = "Bearer $token"

        ApiClient.apiService.getJoinedCommunities(auth)
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fallbackCommunity()
                        return
                    }

                    val joined = response.body()!!.communities
                    selectedCommunities.clear()

                    val defaultSelectionIds = mutableSetOf<String>()
                    primary?.id?.let { defaultSelectionIds.add(it) }
                    defaultSelectionIds.addAll(joined.mapNotNull { it.id })

                    val savedSelectionIds = getSavedSelectedCommunityIds()
                    applySelectedCommunityIds(savedSelectionIds ?: defaultSelectionIds)

                    if (selectedCommunities.isEmpty()) {
                        when {
                            savedSelectionIds == null && allCommunities.isNotEmpty() -> {
                                selectedCommunities.add(allCommunities.first())
                            }
                            savedSelectionIds?.isNotEmpty() == true -> {
                                applySelectedCommunityIds(defaultSelectionIds)
                                if (selectedCommunities.isEmpty() && allCommunities.isNotEmpty()) {
                                    selectedCommunities.add(allCommunities.first())
                                }
                            }
                        }
                    }

                    updateSelectedCommunitiesUI()
                    loadFeed()
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
                    fallbackCommunity()
                }
            })
    }

    private fun fallbackCommunity() {
        allCommunities = emptyList()
        selectedCommunities.clear()
        updateSelectedCommunitiesUI()
        loadFeed()
    }

    private fun selectAllCommunitiesFromStory() {
        if (allCommunities.isEmpty()) {
            showCommunitySelectorDialog()
            return
        }

        selectedCommunities.clear()
        selectedCommunities.addAll(allCommunities.filter { !it.id.isNullOrBlank() })
        saveSelectedCommunities()
        updateSelectedCommunitiesUI()
        loadFeed()
    }

    private fun selectCommunityFromStory(community: Community) {
        if (community.id.isNullOrBlank()) {
            return
        }

        selectedCommunities.clear()
        selectedCommunities.add(community)
        saveSelectedCommunities()
        updateSelectedCommunitiesUI()
        loadFeed()
    }

    private fun showCommunitySelectorDialog() {
        if (allCommunities.isEmpty()) {
            Toast.makeText(requireContext(), "No communities found.", Toast.LENGTH_SHORT).show()
            return
        }

        val selectedIds = selectedCommunities.mapNotNull { it.id }.toMutableSet()
        val names = allCommunities
            .map { it.displayName ?: it.name ?: "Unnamed community" }
            .toTypedArray()
        val checkedItems = BooleanArray(allCommunities.size) { i ->
            allCommunities[i].id in selectedIds
        }

        val dialog = AlertDialog.Builder(requireContext())
            .setTitle("Select Communities")
            .setMultiChoiceItems(names, checkedItems) { _, which, isChecked ->
                val community = allCommunities[which]
                val communityId = community.id

                if (!communityId.isNullOrBlank()) {
                    if (isChecked) {
                        selectedIds.add(communityId)
                    } else {
                        selectedIds.remove(communityId)
                    }
                }
            }
            .setPositiveButton("OK") { dialog, _ ->
                applySelectedCommunityIds(selectedIds)
                saveSelectedCommunities()
                updateSelectedCommunitiesUI()
                loadFeed()
                dialog.dismiss()
            }
            .setNeutralButton("Select all", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            val actionColor = ContextCompat.getColor(requireContext(), R.color.yenkasa_emerald)
            val cancelColor = ContextCompat.getColor(requireContext(), R.color.yenkasa_black)

            dialog.getButton(DialogInterface.BUTTON_POSITIVE)?.setTextColor(actionColor)
            dialog.getButton(DialogInterface.BUTTON_NEGATIVE)?.setTextColor(cancelColor)
            dialog.getButton(DialogInterface.BUTTON_NEUTRAL)?.setTextColor(actionColor)
            dialog.getButton(DialogInterface.BUTTON_NEUTRAL)?.setOnClickListener {
                selectedIds.clear()
                allCommunities.forEachIndexed { index, community ->
                    community.id?.let { selectedIds.add(it) }
                    dialog.listView?.setItemChecked(index, true)
                }
            }
            dialog.listView?.isVerticalScrollBarEnabled = true
        }

        dialog.show()
    }

    private fun applySelectedCommunityIds(selectedIds: Set<String>) {
        selectedCommunities.clear()
        selectedCommunities.addAll(
            allCommunities.filter { community ->
                val communityId = community.id
                communityId != null && selectedIds.contains(communityId)
            }
        )
    }

    private fun saveSelectedCommunities() {
        val selectedIds = selectedCommunities.mapNotNull { it.id }.toSet()
        TokenManager.saveSelectedCommunityIds(requireContext(), userId, selectedIds)
    }

    private fun getSavedSelectedCommunityIds(): Set<String>? {
        return TokenManager.getSelectedCommunityIds(requireContext(), userId)
    }

    private fun updateSelectedCommunitiesUI() {
        val text = selectedCommunities.joinToString(", ") { it.displayName ?: it.name ?: "Unknown" }
        selectedCommunitiesText.text = if (text.isEmpty()) "No community selected" else text

        communityNameView.text = when (selectedCommunities.size) {
            0 -> "No Community"
            1 -> selectedCommunities.first().displayName ?: selectedCommunities.first().name ?: "Unnamed"
            else -> "Multiple Communities"
        }

        updateCommunityStoryRow()
    }

    private fun updateCommunityStoryRow() {
        if (!::communityStoryAdapter.isInitialized) return
        communityStoryAdapter.submitCommunities(
            sortCommunitiesForStoryRow(allCommunities),
            selectedCommunities.mapNotNull { it.id }.toSet(),
            communityStoryPreviews
        )
    }

    private fun sortCommunitiesForStoryRow(communities: List<Community>): List<Community> {
        val recentIds = TokenManager.getRecentPostedCommunityIds(requireContext())
        if (recentIds.isEmpty()) return communities

        val recentOrder = recentIds.withIndex().associate { it.value to it.index }
        return communities.sortedWith(
            compareBy<Community> { community ->
                recentOrder[community.id] ?: Int.MAX_VALUE
            }.thenBy { community ->
                community.displayName ?: community.name ?: ""
            }
        )
    }

    private fun loadCommunityStoryPreviews() {
        val authToken = token ?: return
        val names = allCommunities
            .mapNotNull { it.displayName ?: it.name }
            .filter { it.isNotBlank() }

        if (names.isEmpty()) {
            communityStoryPreviews = emptyMap()
            updateCommunityStoryRow()
            return
        }

        ApiClient.apiService.getPostsByCommunities(
            "Bearer $authToken",
            names.joinToString(","),
            1,
            100
        ).enqueue(object : Callback<FeedResponse> {
            override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    mergeCommunityStoryPreviews(response.body()!!.posts)
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                Log.w("FeedFragment", "Failed to load community previews: ${t.message}")
            }
        })
    }

    private fun loadFeed(page: Int = 1) {
        if (isLoading) return

        if (selectedFeedMode == FeedMode.FOLLOWING && followingUserIds == null) {
            fetchFollowingUserIds { loadFeed(page) }
            return
        }

        isLoading = true
        showLoading(true)

        val names = selectedCommunities.mapNotNull { it.displayName ?: it.name }
        if (names.isEmpty()) {
            posts.clear()
            val mixedList = buildMixedFeed(posts)
            feedAdapter.updateItems(mixedList)

            emptyView.visibility = View.VISIBLE
            isLoading = false
            showLoading(false)
            return
        }

        val namesString = names.joinToString(",")

        ApiClient.apiService.getPostsByCommunities(
            "Bearer $token",
            namesString,
            page,
            20
        ).enqueue(object : Callback<FeedResponse> {

            override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                isLoading = false
                showLoading(false)

                if (response.isSuccessful && response.body() != null) {
                    val sourcePosts = response.body()!!.posts
                    mergeCommunityStoryPreviews(sourcePosts)

                    posts.clear()
                    posts.addAll(applyFeedMode(sourcePosts))
                    val mixedList = buildMixedFeed(posts)
                    feedAdapter.updateItems(mixedList)
                    emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
                } else {
                    Toast.makeText(requireContext(), "Failed to load feed.", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                isLoading = false
                showLoading(false)
                Log.e("FeedFragment", "Network failure: ${t.message}")
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

    private fun applyFeedMode(sourcePosts: List<Post>): List<Post> {
        return when (selectedFeedMode) {
            FeedMode.FOR_YOU -> sourcePosts
            FeedMode.FOLLOWING -> {
                val ids = followingUserIds.orEmpty()
                sourcePosts
                    .filter { ids.contains(it.userId.id) }
                    .sortedByDescending { parsePostTimestampMillis(it.createdAt) ?: 0L }
            }
            FeedMode.TRENDING -> sourcePosts.sortedWith(
                compareByDescending<Post> {
                    it.likeCount + it.commentCount + it.shareCount + it.viewCount
                }.thenByDescending {
                    parsePostTimestampMillis(it.createdAt) ?: 0L
                }
            )
            FeedMode.TOP -> sourcePosts.sortedByDescending {
                parsePostTimestampMillis(it.createdAt) ?: 0L
            }
        }
    }

    private fun mergeCommunityStoryPreviews(sourcePosts: List<Post>) {
        val nextPreviews = communityStoryPreviews.toMutableMap()
        buildCommunityStoryPreviewMap(sourcePosts).forEach { (communityId, preview) ->
            val current = nextPreviews[communityId]
            if (current == null || preview.createdAtMillis >= current.createdAtMillis) {
                nextPreviews[communityId] = preview
            }
        }
        communityStoryPreviews = nextPreviews
        updateCommunityStoryRow()
    }

    private fun buildCommunityStoryPreviewMap(sourcePosts: List<Post>): Map<String, CommunityStoryPreview> {
        return sourcePosts
            .sortedByDescending { parsePostTimestampMillis(it.createdAt) ?: 0L }
            .mapNotNull { post ->
                val communityId = post.communityId?.id ?: return@mapNotNull null
                val mediaUrl = post.effectiveImageUrls().firstOrNull()
                    ?: post.videoUrl?.takeIf { it.isNotBlank() }
                val text = post.caption
                    ?.trim()
                    ?.takeIf { it.isNotBlank() }
                    ?.let { if (it.length > 44) "${it.take(41)}..." else it }

                if (mediaUrl.isNullOrBlank() && text.isNullOrBlank()) {
                    return@mapNotNull null
                }

                communityId to CommunityStoryPreview(
                    mediaUrl = mediaUrl,
                    text = text,
                    createdAtMillis = parsePostTimestampMillis(post.createdAt) ?: 0L
                )
            }
            .distinctBy { it.first }
            .toMap()
    }

    private fun parsePostTimestampMillis(rawTimestamp: String?): Long? {
        if (rawTimestamp.isNullOrBlank()) return null

        rawTimestamp.toLongOrNull()?.let { value ->
            return if (value < 10_000_000_000L) value * 1000 else value
        }

        val formats = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSSXXX",
            "yyyy-MM-dd'T'HH:mm:ssXXX"
        )

        return formats.firstNotNullOfOrNull { pattern ->
            runCatching {
                SimpleDateFormat(pattern, Locale.US).apply {
                    timeZone = TimeZone.getTimeZone("UTC")
                }.parse(rawTimestamp)?.time
            }.getOrNull()
        }
    }

    private fun openComments(post: Post) {
        val intent = Intent(requireContext(), CommentsActivity::class.java)
        intent.putExtra("POST_ID", post._id)
        startActivity(intent)
    }

    private fun openUserProfile(userId: String) {
        val intent = Intent(requireContext(), UserProfileActivity::class.java)
        intent.putExtra("USER_ID", userId)
        startActivity(intent)
    }

    private fun trackDailyLogin() {
        ApiClient.apiService.trackLogin("Bearer $token").enqueue(object : Callback<TrackLoginResponse> {
            override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) {}
            override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                Log.e("FeedFragment", "Login track failed: ${t.message}")
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show && currentPage == 1) View.VISIBLE else View.GONE
    }

    private fun updateSourcePostViewCount(postId: String, viewsCount: Int) {
        val index = posts.indexOfFirst { it._id == postId }
        if (index >= 0) {
            posts[index] = posts[index].copy(viewCount = viewsCount)
        }
    }


    private fun setupSocketListeners() {
        SocketManager.on("newPost") { data ->
            try {
                val json = data as JSONObject
                val newPost = Post.fromJson(json)
                lifecycleScope.launch {
                    posts.add(0, newPost)
                    val mixed = buildMixedFeed(posts)
                    feedAdapter.updateItems(mixed)

                    recyclerView.scrollToPosition(0)
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing newPost")
            }
        }
        SocketManager.on("viewUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val viewsCount = json.getInt("viewsCount")

                lifecycleScope.launch {
                    updateSourcePostViewCount(postId, viewsCount)
                    feedAdapter.updatePostViewCount(postId, viewsCount)
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing viewUpdate: ${e.message}")
            }
        }

        SocketManager.on("likeUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val likeCount = json.getInt("likeCount")

                lifecycleScope.launch {
                    val index = posts.indexOfFirst { it._id == postId }
                    if (index >= 0) {
                        posts[index] = posts[index].copy(likeCount = likeCount)
                        val mixed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixed)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing likeUpdate")
            }
        }
    }

    private fun confirmDeletePost(post: Post) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete post")
            .setMessage("Are you sure you want to delete this post?")
            .setPositiveButton("Delete") { _, _ ->
                deletePost(post)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun downloadPost(post: Post) {
        ApiClient.apiService.getPostMedia(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<MediaResponse> {

            override fun onResponse(
                call: Call<MediaResponse>,
                response: Response<MediaResponse>
            ) {
                if (!response.isSuccessful || response.body() == null) {
                    Toast.makeText(requireContext(), "Failed to get media", Toast.LENGTH_SHORT).show()
                    return
                }

                val media = response.body()!!.media

                val url = media.firstImageUrl()
                    ?: media.videoUrl
                    ?: media.audioUrl

                if (url.isNullOrEmpty()) {
                    Toast.makeText(requireContext(), "No media found", Toast.LENGTH_SHORT).show()
                    return
                }

                // Open system downloader / browser
                startActivity(
                    Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse(url)
                    }
                )
            }

            override fun onFailure(call: Call<MediaResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Download failed", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun deletePost(post: Post) {
        ApiClient.apiService.deletePost(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                if (response.isSuccessful) {
                    posts.removeAll { it._id == post._id }
                    feedAdapter.updateItems(buildMixedFeed(posts))
                    Toast.makeText(requireContext(), "Post deleted", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(requireContext(), "Delete failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Network error", Toast.LENGTH_SHORT).show()
            }
        })
    }
    private fun hidePost(post: Post) {
        ApiClient.apiService.hidePost(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                posts.removeAll { it._id == post._id }
                feedAdapter.updateItems(buildMixedFeed(posts))
                Toast.makeText(requireContext(), "Post hidden", Toast.LENGTH_SHORT).show()
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Failed to hide post", Toast.LENGTH_SHORT).show()
            }
        })
    }
    private fun flagPost(post: Post) {
        val request = FlagRequest(
            reason = "inappropriate"
        )

        ApiClient.apiService.flagPost(
            post._id,
            "Bearer $token",
            request
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                if (response.isSuccessful) {
                    Toast.makeText(
                        requireContext(),
                        "Post reported successfully",
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    Toast.makeText(
                        requireContext(),
                        "Failed to report post",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(
                    requireContext(),
                    "Report failed: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    override fun onResume() {
        super.onResume()
    }

    override fun onPause() {
        super.onPause()
        feedAdapter.pauseAllVideos()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        feedAdapter.pauseAllVideos()
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
    }

}
