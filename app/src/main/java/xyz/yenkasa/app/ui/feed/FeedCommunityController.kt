package xyz.yenkasa.app.ui.feed

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.google.android.material.bottomsheet.BottomSheetDialog
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.FeedCommunityStoryAdapter
import xyz.yenkasa.app.adapter.CommunityStoryPreview
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.FeedResponse
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager

class FeedCommunityController(
    private val context: Context,
    private val tokenProvider: () -> String?,
    private val userIdProvider: () -> String?
) {
    var allCommunities: List<Community> = emptyList()
        private set
    val selectedCommunities = mutableSetOf<Community>()
    var communityStoryPreviews: Map<String, CommunityStoryPreview> = emptyMap()
        private set

    fun fetchCommunitiesAndSelection(
        onSelectionReady: () -> Unit,
        onSelectionChanged: () -> Unit
    ) {
        val auth = "Bearer ${tokenProvider()}"
        ApiClient.apiService.getCommunities(auth)
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fetchPublicCommunitiesFallback(onSelectionReady, onSelectionChanged)
                        return
                    }

                    allCommunities = response.body().orEmpty()
                    if (allCommunities.isEmpty()) {
                        fetchPublicCommunitiesFallback(onSelectionReady, onSelectionChanged)
                        return
                    }
                    fetchUserMembership(onSelectionReady, onSelectionChanged)
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    Log.w("FeedCommunityController", "Authenticated communities failed: ${t.message}")
                    fetchPublicCommunitiesFallback(onSelectionReady, onSelectionChanged)
                }
            })
    }

    private fun fetchPublicCommunitiesFallback(
        onSelectionReady: () -> Unit,
        onSelectionChanged: () -> Unit
    ) {
        ApiClient.apiService.getPublicCommunities()
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    allCommunities = response.body().orEmpty()
                    if (allCommunities.isEmpty()) {
                        fallbackSelection()
                        onSelectionChanged()
                        onSelectionReady()
                        return
                    }
                    fetchUserMembership(onSelectionReady, onSelectionChanged)
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    Log.w("FeedCommunityController", "Public communities fallback failed: ${t.message}")
                    fallbackSelection()
                    onSelectionChanged()
                    onSelectionReady()
                }
            })
    }

    fun selectedLabelText(): String {
        val text = selectedCommunities.joinToString(", ") {
            it.displayName ?: it.name ?: context.getString(R.string.unknown)
        }
        return if (text.isEmpty()) context.getString(R.string.no_community_selected) else text
    }

    fun headerTitle(): String {
        return when (selectedCommunities.size) {
            0 -> context.getString(R.string.no_community)
            1 -> selectedCommunities.first().displayName ?: selectedCommunities.first().name ?: context.getString(R.string.unnamed)
            else -> context.getString(R.string.multiple_communities)
        }
    }

    fun selectedIds(): Set<String> = selectedCommunities.mapNotNull { it.id }.toSet()

    fun selectedNamesCsv(): String {
        return selectedCommunities
            .mapNotNull { it.displayName ?: it.name }
            .joinToString(",")
    }

    fun setupStoryRecyclerView(
        recyclerView: RecyclerView,
        onAllCommunitiesClick: () -> Unit,
        onCommunityClick: (Community) -> Unit
    ): FeedCommunityStoryAdapter {
        val adapter = FeedCommunityStoryAdapter(
            onAllCommunitiesClick = onAllCommunitiesClick,
            onCommunityClick = onCommunityClick
        )
        recyclerView.layoutManager =
            LinearLayoutManager(context, LinearLayoutManager.HORIZONTAL, false)
        recyclerView.adapter = adapter
        return adapter
    }

    fun applySelectionToUi(
        selectedCommunitiesText: TextView,
        communityNameView: TextView,
        communityStoryAdapter: FeedCommunityStoryAdapter?,
        onPlayerCommunitiesUpdated: (List<Community>, Set<String>) -> Unit
    ) {
        selectedCommunitiesText.text = selectedLabelText()
        communityNameView.text = headerTitle()
        updateCommunityStoryRow(communityStoryAdapter)
        onPlayerCommunitiesUpdated(allCommunities, selectedIds())
    }

    fun updateCommunityStoryRow(communityStoryAdapter: FeedCommunityStoryAdapter?) {
        communityStoryAdapter ?: return
        communityStoryAdapter.submitCommunities(
            sortCommunitiesForStoryRow(),
            selectedIds(),
            communityStoryPreviews
        )
    }

    fun handleSelectAllCommunities(
        onNoCommunities: () -> Unit,
        onSelectionChanged: () -> Unit,
        onFeedReloadRequested: () -> Unit
    ) {
        if (allCommunities.isEmpty()) {
            onNoCommunities()
            return
        }

        selectAllCommunities(onSelectionChanged)
        onFeedReloadRequested()
    }

    fun handleSelectCommunity(
        community: Community,
        onSelectionChanged: () -> Unit,
        onFeedReloadRequested: () -> Unit
    ) {
        selectCommunity(community, onSelectionChanged)
        onFeedReloadRequested()
    }

    fun openCommunitySelector(
        onNoCommunities: () -> Unit,
        onSelectionChanged: () -> Unit,
        onFeedReloadRequested: () -> Unit
    ) {
        if (allCommunities.isEmpty()) {
            onNoCommunities()
            return
        }

        showCommunitySelectorDialog {
            onSelectionChanged()
            onFeedReloadRequested()
        }
    }

    fun selectAllCommunities(onSelectionChanged: () -> Unit) {
        if (allCommunities.isEmpty()) return
        selectedCommunities.clear()
        selectedCommunities.addAll(allCommunities.filter { !it.id.isNullOrBlank() })
        saveSelectedCommunities()
        onSelectionChanged()
    }

    fun selectCommunity(community: Community, onSelectionChanged: () -> Unit) {
        if (community.id.isNullOrBlank()) return
        selectedCommunities.clear()
        selectedCommunities.add(community)
        saveSelectedCommunities()
        onSelectionChanged()
    }

    fun showCommunitySelectorDialog(onSelectionChanged: () -> Unit) {
        if (allCommunities.isEmpty()) return

        val selectedIds = selectedIds().toMutableSet()
        val dialog = BottomSheetDialog(context)
        val listContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(18))
        }

        fun refreshRows() {
            listContainer.removeAllViews()
            listContainer.addView(
                buildSelectorRow(
                    title = context.getString(R.string.all_communities),
                    subtitle = context.resources.getQuantityString(
                        R.plurals.communities_available_count,
                        allCommunities.size,
                        allCommunities.size
                    ),
                    imageUrl = null,
                    selected = selectedIds.size == allCommunities.mapNotNull { it.id }.size,
                    onClick = {
                        selectedIds.clear()
                        allCommunities.mapNotNull { it.id }.forEach { selectedIds.add(it) }
                        refreshRows()
                    }
                )
            )
            allCommunities.forEach { community ->
                val communityId = community.id ?: return@forEach
                val title = community.displayName ?: community.name ?: context.getString(R.string.unnamed_community)
                val subtitle = when {
                    community.memberCount > 0 -> context.getString(R.string.members_compact, formatCompact(community.memberCount))
                    community.postCount > 0 -> context.getString(R.string.posts_compact, formatCompact(community.postCount))
                    else -> context.getString(R.string.tap_to_select)
                }
                listContainer.addView(
                    buildSelectorRow(
                        title = title,
                        subtitle = subtitle,
                        imageUrl = community.coverImage ?: community.icon,
                        selected = selectedIds.contains(communityId),
                        onClick = {
                            if (selectedIds.contains(communityId)) {
                                selectedIds.remove(communityId)
                            } else {
                                selectedIds.add(communityId)
                            }
                            refreshRows()
                        }
                    )
                )
            }
        }

        val root = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                cornerRadii = floatArrayOf(
                    dp(24).toFloat(), dp(24).toFloat(),
                    dp(24).toFloat(), dp(24).toFloat(),
                    0f, 0f,
                    0f, 0f
                )
                setColor(Color.parseColor("#F8FFF9"))
            }
            setPadding(0, dp(8), 0, 0)
        }

        val handle = View(context).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(999).toFloat()
                setColor(Color.parseColor("#D5E6DA"))
            }
            layoutParams = LinearLayout.LayoutParams(dp(46), dp(4)).apply {
                gravity = Gravity.CENTER_HORIZONTAL
                bottomMargin = dp(12)
            }
        }

        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), 0, dp(18), dp(10))
        }
        header.addView(TextView(context).apply {
            text = context.getString(R.string.choose_communities)
            textSize = 20f
            setTextColor(Color.parseColor("#102016"))
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        })
        header.addView(TextView(context).apply {
            text = context.getString(R.string.done)
            textSize = 14f
            setTextColor(Color.parseColor("#0B8F43"))
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(14), dp(8), dp(14), dp(8))
            background = GradientDrawable().apply {
                cornerRadius = dp(999).toFloat()
                setColor(Color.parseColor("#E4FBEA"))
            }
            setOnClickListener {
                applySelectedCommunityIds(selectedIds)
                saveSelectedCommunities()
                onSelectionChanged()
                dialog.dismiss()
            }
        })

        val scroll = ScrollView(context).apply {
            isVerticalScrollBarEnabled = false
            addView(listContainer)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(520)
            )
        }

        root.addView(handle)
        root.addView(header)
        root.addView(scroll)
        refreshRows()
        dialog.setContentView(root)
        dialog.show()
    }

    private fun buildSelectorRow(
        title: String,
        subtitle: String,
        imageUrl: String?,
        selected: Boolean,
        onClick: () -> Unit
    ): View {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(8))
            background = GradientDrawable().apply {
                cornerRadius = dp(18).toFloat()
                setColor(Color.parseColor(if (selected) "#E7FFF0" else "#FFFFFFFF"))
                setStroke(dp(if (selected) 2 else 1), Color.parseColor(if (selected) "#20C863" else "#E4EFE7"))
            }
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(74)
            ).apply {
                bottomMargin = dp(10)
            }
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

        row.addView(buildSelectorImage(title, imageUrl, selected))
        row.addView(LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f).apply {
                leftMargin = dp(12)
            }
            addView(TextView(context).apply {
                text = title
                textSize = 15f
                maxLines = 1
                setTextColor(Color.parseColor(if (selected) "#0A7D39" else "#16241A"))
                setTypeface(typeface, Typeface.BOLD)
            })
            addView(TextView(context).apply {
                text = subtitle
                textSize = 12f
                maxLines = 1
                setTextColor(Color.parseColor("#718276"))
            })
        })
        row.addView(TextView(context).apply {
            text = if (selected) "✓" else ""
            textSize = 13f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor(if (selected) "#20C863" else "#EEF4F0"))
            }
            layoutParams = LinearLayout.LayoutParams(dp(24), dp(24))
        })
        return row
    }

    private fun buildSelectorImage(title: String, imageUrl: String?, selected: Boolean): View {
        val frame = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(52), dp(52))
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#102016"))
                setStroke(dp(if (selected) 2 else 1), Color.parseColor(if (selected) "#20C863" else "#DCE7DF"))
            }
            clipToOutline = true
        }
        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            setImageResource(R.drawable.ic_yenkasa_logo)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        if (!imageUrl.isNullOrBlank()) {
            Glide.with(context)
                .load(imageUrl)
                .placeholder(R.drawable.ic_yenkasa_logo)
                .error(R.drawable.ic_yenkasa_logo)
                .into(image)
        }
        val label = TextView(context).apply {
            text = if (imageUrl.isNullOrBlank()) title.take(1).uppercase() else ""
            textSize = 17f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        frame.addView(image)
        frame.addView(label)
        return frame
    }

    fun sortCommunitiesForStoryRow(): List<Community> {
        val recentIds = TokenManager.getRecentPostedCommunityIds(context)
        if (recentIds.isEmpty()) return allCommunities

        val recentOrder = recentIds.withIndex().associate { it.value to it.index }
        return allCommunities.sortedWith(
            compareBy<Community> { community ->
                recentOrder[community.id] ?: Int.MAX_VALUE
            }.thenBy { community ->
                community.displayName ?: community.name ?: ""
            }
        )
    }

    fun loadCommunityStoryPreviews(onUpdated: () -> Unit) {
        val authToken = tokenProvider() ?: return
        val names = allCommunities
            .mapNotNull { it.displayName ?: it.name }
            .filter { it.isNotBlank() }

        if (names.isEmpty()) {
            communityStoryPreviews = emptyMap()
            onUpdated()
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
                    mergeCommunityStoryPreviews(response.body()?.posts.orEmpty())
                    onUpdated()
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                Log.w("FeedCommunityController", "Failed to load community previews: ${t.message}")
            }
        })
    }

    fun mergeCommunityStoryPreviews(sourcePosts: List<Post>) {
        val nextPreviews = communityStoryPreviews.toMutableMap()
        buildCommunityStoryPreviewMap(sourcePosts).forEach { (communityId, preview) ->
            val current = nextPreviews[communityId]
            if (current == null || preview.createdAtMillis >= current.createdAtMillis) {
                nextPreviews[communityId] = preview
            }
        }
        communityStoryPreviews = nextPreviews
    }

    private fun fetchUserMembership(
        onSelectionReady: () -> Unit,
        onSelectionChanged: () -> Unit
    ) {
        val auth = "Bearer ${tokenProvider()}"
        ApiClient.apiService.getUserPrimaryCommunity(auth)
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    fetchJoinedCommunities(response.body()?.community, onSelectionReady, onSelectionChanged)
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    Log.w("FeedCommunityController", "Primary community failed: ${t.message}")
                    fetchJoinedCommunities(null, onSelectionReady, onSelectionChanged)
                }
            })
    }

    private fun fetchJoinedCommunities(
        primary: Community?,
        onSelectionReady: () -> Unit,
        onSelectionChanged: () -> Unit
    ) {
        val auth = "Bearer ${tokenProvider()}"
        ApiClient.apiService.getJoinedCommunities(auth)
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fallbackSelection()
                        onSelectionChanged()
                        onSelectionReady()
                        return
                    }

                    val joined = response.body()?.communities.orEmpty()
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

                    onSelectionChanged()
                    onSelectionReady()
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
                    Log.w("FeedCommunityController", "Joined communities failed: ${t.message}")
                    fallbackSelection()
                    onSelectionChanged()
                    onSelectionReady()
                }
            })
    }

    private fun fallbackSelection() {
        selectedCommunities.clear()
        communityStoryPreviews = emptyMap()
        if (allCommunities.isNotEmpty()) {
            selectedCommunities.addAll(allCommunities.filter { !it.id.isNullOrBlank() })
        }
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
        TokenManager.saveSelectedCommunityIds(context, userIdProvider(), selectedIds())
    }

    private fun formatCompact(value: Int): String {
        return if (value >= 1000) {
            "${String.format("%.1f", value / 1000f)}K"
        } else {
            value.toString()
        }
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()

    private fun getSavedSelectedCommunityIds(): Set<String>? {
        return TokenManager.getSelectedCommunityIds(context, userIdProvider())
    }

    private fun buildCommunityStoryPreviewMap(sourcePosts: List<Post>): Map<String, CommunityStoryPreview> {
        return sourcePosts
            .sortedByDescending { FeedTimeUtils.parsePostTimestampMillis(it.createdAt) ?: 0L }
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
                    createdAtMillis = FeedTimeUtils.parsePostTimestampMillis(post.createdAt) ?: 0L
                )
            }
            .distinctBy { it.first }
            .toMap()
    }
}
