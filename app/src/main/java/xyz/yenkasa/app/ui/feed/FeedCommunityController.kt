package xyz.yenkasa.app.ui.feed

import android.app.AlertDialog
import android.content.Context
import android.content.DialogInterface
import android.util.Log
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
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
                        fallbackSelection()
                        onSelectionChanged()
                        onSelectionReady()
                        return
                    }

                    allCommunities = response.body().orEmpty()
                    fetchUserMembership(onSelectionReady, onSelectionChanged)
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    fallbackSelection()
                    onSelectionChanged()
                    onSelectionReady()
                }
            })
    }

    fun selectedLabelText(): String {
        val text = selectedCommunities.joinToString(", ") { it.displayName ?: it.name ?: "Unknown" }
        return if (text.isEmpty()) "No community selected" else text
    }

    fun headerTitle(): String {
        return when (selectedCommunities.size) {
            0 -> "No Community"
            1 -> selectedCommunities.first().displayName ?: selectedCommunities.first().name ?: "Unnamed"
            else -> "Multiple Communities"
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
        val names = allCommunities
            .map { it.displayName ?: it.name ?: "Unnamed community" }
            .toTypedArray()
        val checkedItems = BooleanArray(allCommunities.size) { i ->
            allCommunities[i].id in selectedIds
        }

        val dialog = AlertDialog.Builder(context)
            .setTitle("Select Communities")
            .setMultiChoiceItems(names, checkedItems) { _, which, isChecked ->
                val community = allCommunities[which]
                val communityId = community.id ?: return@setMultiChoiceItems
                if (isChecked) selectedIds.add(communityId) else selectedIds.remove(communityId)
            }
            .setPositiveButton("OK") { dialogInterface, _ ->
                applySelectedCommunityIds(selectedIds)
                saveSelectedCommunities()
                onSelectionChanged()
                dialogInterface.dismiss()
            }
            .setNeutralButton("Select all", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            val actionColor = ContextCompat.getColor(context, R.color.yenkasa_emerald)
            val cancelColor = ContextCompat.getColor(context, R.color.yenkasa_black)
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
                    fallbackSelection()
                    onSelectionChanged()
                    onSelectionReady()
                }
            })
    }

    private fun fallbackSelection() {
        allCommunities = emptyList()
        selectedCommunities.clear()
        communityStoryPreviews = emptyMap()
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
