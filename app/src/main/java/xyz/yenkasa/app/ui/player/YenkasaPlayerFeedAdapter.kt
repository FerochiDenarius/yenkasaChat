package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.Log
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.ViewRequest
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager

class YenkasaPlayerFeedAdapter(
    private val context: Context,
    private val actions: YenkasaPlayerActions,
    private val onViewCountUpdated: (String, Int) -> Unit
) : RecyclerView.Adapter<YenkasaPlayerFeedAdapter.PlayerViewHolder>() {

    private val posts = mutableListOf<Post>()
    private var communities: List<Community> = emptyList()
    private var selectedCommunityIds: Set<String> = emptySet()
    private val savedPostIds = mutableSetOf<String>()
    private val lastViewTime = mutableMapOf<String, Long>()
    private var activePosition = RecyclerView.NO_POSITION
    private var muted = true

    inner class PlayerViewHolder(val playerView: YenkasaPlayerView) : RecyclerView.ViewHolder(playerView)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): PlayerViewHolder {
        val view = YenkasaPlayerView(parent.context).apply {
            layoutParams = RecyclerView.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        return PlayerViewHolder(view)
    }

    override fun onBindViewHolder(holder: PlayerViewHolder, position: Int) {
        val post = posts[position]
        val item = YenkasaPlayerItem.fromPost(post, TokenManager.getCoins(context).toDouble())
        holder.playerView.bind(
            post = post,
            item = item,
            communities = communities,
            selectedCommunityIds = selectedCommunityIds,
            saved = savedPostIds.contains(post._id),
            position = position,
            actions = actions,
            initialMuted = muted,
            onMuteChanged = { muted = it },
            onPlaybackCheckpoint = { seconds ->
                sendRewardView(post, seconds)
            }
        )
        holder.playerView.setActive(position == activePosition)
    }

    override fun getItemCount(): Int = posts.size

    override fun onViewDetachedFromWindow(holder: PlayerViewHolder) {
        super.onViewDetachedFromWindow(holder)
        holder.playerView.release()
    }

    override fun onViewRecycled(holder: PlayerViewHolder) {
        super.onViewRecycled(holder)
        holder.playerView.release()
    }

    fun submitPosts(newPosts: List<Post>) {
        posts.clear()
        posts.addAll(newPosts)
        notifyDataSetChanged()
    }

    fun updateCommunities(allCommunities: List<Community>, selectedIds: Set<String>) {
        communities = allCommunities
        selectedCommunityIds = selectedIds
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
        if (position !in posts.indices) return
        if (activePosition == position) {
            (recyclerView.findViewHolderForAdapterPosition(position) as? PlayerViewHolder)
                ?.playerView
                ?.setActive(true)
            posts.getOrNull(position)?.let { post -> recordVisibleView(post) }
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

        posts.getOrNull(position)?.let { post ->
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
                            WalletBalanceManager.refreshAfterReward(
                                context,
                                body.rewardAmount ?: body.rewardTransaction?.amount
                            )
                        }
                    }
                }
            } catch (error: Exception) {
                Log.e("YenkasaPlayerFeed", "Failed to record view: ${error.message}")
            }
        }
    }
}
