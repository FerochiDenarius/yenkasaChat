package xyz.yenkasa.app.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.model.Post


class FeedAdapter(
    private val context: Context,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post, Int) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit,
    private val onShareClick: (Post) -> Unit,
    private val onViewCountUpdated: (String, Int) -> Unit = { _, _ -> },
    private val adAdapterCallbacks: AdAdapterCallbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val TYPE_POST = 0
    private val TYPE_YENKASA_AD = 1
    private val TYPE_ADMOB_AD = 2

    private var items: List<Any> = emptyList()

    init {
        setHasStableIds(true)
        stateRestorationPolicy = StateRestorationPolicy.PREVENT_WHEN_EMPTY
    }

    // 🔥 NEW CALLBACKS FOR DELETE / HIDE / DOWNLOAD / FLAG
    var onDelete: ((Post) -> Unit)? = null
    var onHide: ((Post) -> Unit)? = null
    var onDownload: ((Post) -> Unit)? = null
    var onFlag: ((Post) -> Unit)? = null

    // Internal PostAdapter handling all post logic
    private val internalPostAdapter = PostAdapter(
        context,
        emptyList(),
        onLikeClick = { post, position -> onLikeClick(post, position) },
        onCommentClick = { post, position -> onCommentClick(post, position) },
        onUserClick = { id -> onUserClick(id) },
        onPostClick = { post -> onPostClick(post) },
        onShareClick = { post -> onShareClick(post) },
        onViewCountUpdated = { postId, viewsCount ->
            updatePostViewCount(postId, viewsCount)
            onViewCountUpdated(postId, viewsCount)
        }
    ).apply {
        // 🔥 FORWARD PostAdapter option buttons to FeedFragment
        setOnDeleteClickListener { post -> onDelete?.invoke(post) }
        setOnHideClickListener { post -> onHide?.invoke(post) }
        setOnDownloadClickListener { post -> onDownload?.invoke(post) }
        setOnFlagClickListener { post -> onFlag?.invoke(post) }
    }

    private var currentPostsForInternal = listOf<Post>()

    override fun getItemViewType(position: Int): Int {
        return when (items[position]) {
            is Post -> TYPE_POST
            is AdModel -> {
                val ad = items[position] as AdModel
                if (
                    ad.adType.equals("google", ignoreCase = true) ||
                    ad.sponsorName.equals("AdMob", ignoreCase = true) ||
                    ad._id.startsWith("local-ad")
                ) {
                    TYPE_ADMOB_AD
                } else {
                    TYPE_YENKASA_AD
                }
            }
            else -> error("Unsupported item at position $position")
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        return when (viewType) {
            TYPE_POST -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_post, parent, false)
                internalPostAdapter.PostViewHolder(view)
            }

            TYPE_YENKASA_AD -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_yenkasa_ad, parent, false)
                YenkasaAdViewHolder(view)
            }

            TYPE_ADMOB_AD -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_admob_native, parent, false)
                AdMobAdViewHolder(view)
            }

            else -> error("Unknown view type: $viewType")
        }
    }

    override fun getItemCount(): Int = items.size

    override fun getItemId(position: Int): Long {
        return stableItemKey(items[position]).hashCode().toLong()
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val obj = items[position]) {

            is Post -> {
                val indexInPosts = computePostIndex(position)

                internalPostAdapter.onBindViewHolder(
                    holder as PostAdapter.PostViewHolder,
                    indexInPosts
                )
            }

            is AdModel -> {
                when (holder) {
                    is YenkasaAdViewHolder -> adAdapterCallbacks.bindYenkasa(holder, obj)
                    is AdMobAdViewHolder -> adAdapterCallbacks.bindAdMob(holder, obj)
                    else -> error("Unsupported ad holder ${holder::class.java.simpleName}")
                }
            }
        }
    }

    private fun computePostIndex(adapterPosition: Int): Int {
        var idx = 0
        for (i in 0 until adapterPosition) {
            if (items[i] is Post) idx++
        }
        return idx
    }

    private fun extractPosts(list: List<Any>): List<Post> =
        list.filterIsInstance<Post>()

    private fun totalPostsCount(): Int =
        items.count { it is Post }

    fun updateItems(newItems: List<Any>) {
        val oldItems = items
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
        items = newItems
        currentPostsForInternal = extractPosts(newItems)
        internalPostAdapter.updatePosts(currentPostsForInternal)
        diff.dispatchUpdatesTo(this)
    }

    private fun stableItemKey(item: Any): String {
        return when (item) {
            is Post -> "post:${item.logicalPostKey?.takeIf { it.isNotBlank() } ?: item.clientRequestId?.takeIf { it.isNotBlank() } ?: item._id}"
            is AdModel -> "ad:${item._id}"
            else -> "unknown:${item.hashCode()}"
        }
    }

    fun updatePostViewCount(postId: String, viewsCount: Int) {
        val index = items.indexOfFirst { it is Post && it._id == postId }
        if (index < 0) return

        items = items.map { item ->
            if (item is Post && item._id == postId) {
                item.copy(viewCount = viewsCount)
            } else {
                item
            }
        }
        currentPostsForInternal = extractPosts(items)
        internalPostAdapter.updatePosts(currentPostsForInternal)
        notifyItemChanged(index)
    }

    // 🔥 NEW → Allow FeedFragment to pause videos safely
    fun pauseAllVideos() {
        internalPostAdapter.pauseAllVideos()
    }

    fun autoPlayCenteredVideo(recyclerView: RecyclerView, adapterPosition: Int) {
        val item = items.getOrNull(adapterPosition) as? Post ?: return
        if (item.videoUrl.isNullOrBlank()) return

        val holder = recyclerView.findViewHolderForAdapterPosition(adapterPosition) as? PostAdapter.PostViewHolder
            ?: return
        internalPostAdapter.autoPlayIfVideo(computePostIndex(adapterPosition), holder)
    }
}
