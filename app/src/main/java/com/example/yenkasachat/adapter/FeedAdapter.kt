package com.example.yenkasachat.adapter

import android.content.Context
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.AdModel
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.adapter.AdsViewHolder



class FeedAdapter(
    private val context: Context,
    private val onLikeClick: (Post, Int) -> Unit,
    private val onCommentClick: (Post, Int) -> Unit,
    private val onUserClick: (String) -> Unit,
    private val onPostClick: (Post) -> Unit,
    private val onShareClick: (Post) -> Unit,
    private val adAdapterCallbacks: AdAdapterCallbacks
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    private val TYPE_POST = 0
    private val TYPE_AD = 1

    private var items: List<Any> = emptyList()

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
        onShareClick = { post -> onShareClick(post) }
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
            is AdModel -> TYPE_AD
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

            TYPE_AD -> {
                val view = LayoutInflater.from(parent.context)
                    .inflate(R.layout.item_ad_post, parent, false)
                AdsViewHolder(view)
            }

            else -> error("Unknown view type: $viewType")
        }
    }

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val obj = items[position]) {

            is Post -> {
                val indexInPosts = computePostIndex(position)

                if (currentPostsForInternal.size != totalPostsCount()) {
                    currentPostsForInternal = extractPosts(items)
                    internalPostAdapter.updatePosts(currentPostsForInternal)
                }

                internalPostAdapter.onBindViewHolder(
                    holder as PostAdapter.PostViewHolder,
                    indexInPosts
                )
            }

            is AdModel -> {
                adAdapterCallbacks.bind(holder as AdsViewHolder, obj)
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
        items = newItems
        currentPostsForInternal = emptyList()
        notifyDataSetChanged()
    }

    // 🔥 NEW → Allow FeedFragment to pause videos safely
    fun pauseAllVideos() {
        internalPostAdapter.pauseAllVideos()
    }
}
