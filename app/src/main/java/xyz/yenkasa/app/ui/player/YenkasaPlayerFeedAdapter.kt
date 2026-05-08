package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.Log
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.AdAdapterCallbacks
import xyz.yenkasa.app.adapter.AdMobAdViewHolder
import xyz.yenkasa.app.adapter.YenkasaAdViewHolder
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.ViewRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.feed.FeedTabsController
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager

class YenkasaPlayerFeedAdapter(
    private val context: Context,
    private val actions: YenkasaPlayerActions,
    private val onViewCountUpdated: (String, Int) -> Unit,
    private val adAdapterCallbacks: AdAdapterCallbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val items = mutableListOf<Any>()
    private var communities: List<Community> = emptyList()
    private var selectedCommunityIds: Set<String> = emptySet()
    private var selectedFeedMode: FeedTabsController.FeedMode = FeedTabsController.FeedMode.FOR_YOU
    private val savedPostIds = mutableSetOf<String>()
    private val lastViewTime = mutableMapOf<String, Long>()
    private var activePosition = RecyclerView.NO_POSITION
    private var muted = true
    private var viewportHeight = 0

    private val typePost = 0
    private val typeYenkasaAd = 1
    private val typeAdMobAd = 2

    inner class PlayerViewHolder(val playerView: YenkasaPlayerView) : RecyclerView.ViewHolder(playerView)

    init {
        setHasStableIds(true)
    }

    override fun getItemViewType(position: Int): Int {
        return when (val item = items[position]) {
            is Post -> typePost
            is AdModel -> if (isAdMobItem(item)) typeAdMobAd else typeYenkasaAd
            else -> error("Unsupported player feed item: ${item::class.java.simpleName}")
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            typePost -> {
                val view = YenkasaPlayerView(parent.context).apply {
                    layoutParams = fullscreenLayoutParams()
                }
                PlayerViewHolder(view)
            }
            typeAdMobAd -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_admob_native, parent, false)
                    .apply { layoutParams = fullscreenLayoutParams() }
                AdMobAdViewHolder(view)
            }
            typeYenkasaAd -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_ad_post, parent, false)
                    .apply { layoutParams = fullscreenLayoutParams() }
                YenkasaAdViewHolder(view)
            }
            else -> error("Unknown player feed view type: $viewType")
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        holder.itemView.layoutParams = fullscreenLayoutParams()
        when (val feedItem = items[position]) {
            is Post -> {
                val item = YenkasaPlayerItem.fromPost(feedItem, TokenManager.getCoins(context).toDouble())
                val sourcePostPosition = computePostIndex(position)
                (holder as PlayerViewHolder).playerView.bind(
                    post = feedItem,
                    item = item,
                    communities = communities,
                    selectedCommunityIds = selectedCommunityIds,
                    saved = savedPostIds.contains(feedItem._id),
                    position = position,
                    sourcePostPosition = sourcePostPosition,
                    selectedFeedMode = selectedFeedMode,
                    actions = actions,
                    initialMuted = muted,
                    onMuteChanged = { muted = it },
                    onPlaybackCheckpoint = { seconds ->
                        sendRewardView(feedItem, seconds)
                    }
                )
                holder.playerView.setActive(position == activePosition)
            }
            is AdModel -> {
                Log.d("YenkasaPlayerAds", "Binding ${feedItem.adType} ad at player index=$position id=${feedItem._id}")
                when (holder) {
                    is AdMobAdViewHolder -> adAdapterCallbacks.bindAdMob(holder, feedItem)
                    is YenkasaAdViewHolder -> adAdapterCallbacks.bindYenkasa(holder, feedItem)
                    else -> error("Unsupported ad holder ${holder::class.java.simpleName}")
                }
            }
        }
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long {
        return stableItemKey(items[position]).hashCode().toLong()
    }

    override fun onViewDetachedFromWindow(holder: RecyclerView.ViewHolder) {
        super.onViewDetachedFromWindow(holder)
        (holder as? PlayerViewHolder)?.playerView?.release()
    }

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        super.onViewRecycled(holder)
        (holder as? PlayerViewHolder)?.playerView?.release()
    }

    fun submitPosts(newPosts: List<Post>) {
        submitItems(newPosts)
    }

    fun setViewportHeight(height: Int) {
        if (height <= 0 || viewportHeight == height) return
        viewportHeight = height
        notifyDataSetChanged()
    }

    fun submitItems(newItems: List<Any>) {
        Log.d(
            "YenkasaPlayerAds",
            "submitItems total=${newItems.size} posts=${newItems.count { it is Post }} ads=${newItems.count { it is AdModel }}"
        )
        val oldItems = items.toList()
        val diff = DiffUtil.calculateDiff(object : DiffUtil.Callback() {
            override fun getOldListSize(): Int = oldItems.size
            override fun getNewListSize(): Int = newItems.size

            override fun areItemsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
                return stableItemKey(oldItems[oldItemPosition]) == stableItemKey(newItems[newItemPosition])
            }

            override fun areContentsTheSame(oldItemPosition: Int, newItemPosition: Int): Boolean {
                return oldItems[oldItemPosition] == newItems[newItemPosition]
            }
        })
        items.clear()
        items.addAll(newItems)
        diff.dispatchUpdatesTo(this)
    }

    fun updateCommunities(allCommunities: List<Community>, selectedIds: Set<String>) {
        communities = allCommunities
        selectedCommunityIds = selectedIds
        notifyDataSetChanged()
    }

    fun updateFeedMode(mode: FeedTabsController.FeedMode) {
        if (selectedFeedMode == mode) return
        selectedFeedMode = mode
        notifyDataSetChanged()
    }

    fun setPostSaved(postId: String, saved: Boolean) {
        if (saved) {
            savedPostIds.add(postId)
        } else {
            savedPostIds.remove(postId)
        }
    }

    fun setActivePosition(recyclerView: RecyclerView, position: Int) {
        if (position !in items.indices) return
        if (activePosition == position) {
            (recyclerView.findViewHolderForAdapterPosition(position) as? PlayerViewHolder)
                ?.playerView
                ?.setActive(true)
            (items.getOrNull(position) as? Post)?.let { post -> recordVisibleView(post) }
            return
        }

        val previous = activePosition
        activePosition = position

        (recyclerView.findViewHolderForAdapterPosition(previous) as? PlayerViewHolder)
            ?.playerView
            ?.setActive(false)

        (recyclerView.findViewHolderForAdapterPosition(position) as? PlayerViewHolder)
            ?.playerView
            ?.setActive(true)

        (items.getOrNull(position) as? Post)?.let { post ->
            recordVisibleView(post)
        }
    }

    fun pauseActive(recyclerView: RecyclerView) {
        (recyclerView.findViewHolderForAdapterPosition(activePosition) as? PlayerViewHolder)
            ?.playerView
            ?.onHostPause()
    }

    fun resumeActive(recyclerView: RecyclerView) {
        (recyclerView.findViewHolderForAdapterPosition(activePosition) as? PlayerViewHolder)
            ?.playerView
            ?.onHostResume()
    }

    fun releaseAll(recyclerView: RecyclerView) {
        if (itemCount == 0) return
        for (i in 0 until itemCount) {
            (recyclerView.findViewHolderForAdapterPosition(i) as? PlayerViewHolder)
                ?.playerView
                ?.release()
        }
    }

    private fun recordVisibleView(post: Post) {
        val now = System.currentTimeMillis()
        if (now - (lastViewTime[post._id] ?: 0L) < 8_000L) return
        lastViewTime[post._id] = now
        sendView(post, 3)
    }

    private fun sendRewardView(post: Post, seconds: Int) {
        sendView(post, seconds)
    }

    private fun sendView(post: Post, seconds: Int) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val token = TokenManager.getToken(context) ?: return@launch
                val response = ApiClient.apiService.recordView(
                    post._id,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = seconds,
                        mediaType = when {
                            !post.videoUrl.isNullOrBlank() -> "video"
                            !post.audioUrl.isNullOrBlank() -> "audio"
                            post.effectiveImageUrls().isNotEmpty() -> "image"
                            else -> "text"
                        }
                    )
                )
                if (response.isSuccessful) {
                    response.body()?.let { body ->
                        if (body.success) {
                            onViewCountUpdated(post._id, maxOf(body.viewsCount, body.viewCount))
                            val rewardAmount = body.rewardAmount ?: body.rewardTransaction?.amount
                            if (body.newBalance != null) {
                                WalletBalanceManager.applyKnownBalance(
                                    context,
                                    body.newBalance,
                                    rewardAmount = rewardAmount
                                )
                            } else {
                                WalletBalanceManager.refreshAfterReward(context, rewardAmount)
                            }
                        }
                    }
                }
            } catch (error: Exception) {
                Log.e("YenkasaPlayerFeed", "Failed to record view: ${error.message}")
            }
        }
    }

    private fun fullscreenLayoutParams(): RecyclerView.LayoutParams {
        return RecyclerView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            viewportHeight.takeIf { it > 0 } ?: ViewGroup.LayoutParams.MATCH_PARENT
        )
    }

    private fun isAdMobItem(ad: AdModel): Boolean {
        return ad.adType.equals("google", ignoreCase = true) ||
            ad.sponsorName.equals("AdMob", ignoreCase = true) ||
            ad._id.startsWith("local-ad")
    }

    private fun stableItemKey(item: Any): String {
        return when (item) {
            is Post -> "post:${item._id}"
            is AdModel -> "ad:${item._id}"
            else -> "unknown:${item.hashCode()}"
        }
    }

    private fun computePostIndex(adapterPosition: Int): Int {
        var postIndex = 0
        for (i in 0 until adapterPosition) {
            if (items[i] is Post) postIndex++
        }
        return postIndex
    }
}
