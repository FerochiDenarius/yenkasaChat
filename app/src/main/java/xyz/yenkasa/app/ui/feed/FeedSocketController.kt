package xyz.yenkasa.app.ui.feed

import android.util.Log
import androidx.lifecycle.LifecycleCoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.network.SocketManager
import java.util.Locale

class FeedSocketController(
    private val lifecycleScope: LifecycleCoroutineScope,
    private val postsProvider: () -> MutableList<Post>,
    private val onPostsChanged: () -> Unit,
    private val onCacheChanged: () -> Unit,
    private val onScrollToTop: () -> Unit,
    private val onViewCountUpdated: (String, Int) -> Unit,
    private val onCommentCountUpdated: (String, Int) -> Unit,
    private val onShareCountUpdated: (String, Int) -> Unit
) {
    private var listenersAttached = false

    fun connect(userId: String?) {
        SocketManager.ensureConnected(userId)
        setupSocketListeners()
    }

    fun detach() {
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
        SocketManager.off("viewUpdate")
        SocketManager.off("commentCountUpdate")
        SocketManager.off("feedUpdate")
        listenersAttached = false
    }

    private fun setupSocketListeners() {
        if (listenersAttached) return
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
        SocketManager.off("viewUpdate")
        SocketManager.off("commentCountUpdate")
        SocketManager.off("feedUpdate")
        listenersAttached = true

        SocketManager.on("newPost") { data ->
            try {
                val newPost = Post.fromJson(data as JSONObject)
                lifecycleScope.launch {
                    val posts = postsProvider()
                    val incomingKey = stablePostEventKey(newPost)
                    if (posts.any { stablePostEventKey(it) == incomingKey }) {
                        Log.d("FeedSocketController", "duplicate newPost skipped key=$incomingKey id=${newPost._id}")
                        return@launch
                    }
                    posts.add(0, newPost)
                    onPostsChanged()
                    onCacheChanged()
                    onScrollToTop()
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing newPost", e)
            }
        }

        SocketManager.on("viewUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val viewsCount = maxOf(
                    json.optInt("viewsCount", 0),
                    json.optInt("viewCount", 0)
                )
                lifecycleScope.launch {
                    onViewCountUpdated(postId, viewsCount)
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing viewUpdate: ${e.message}")
            }
        }

        SocketManager.on("commentCountUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val commentCount = maxOf(
                    json.optInt("commentCount", 0),
                    json.optInt("commentsCount", 0)
                )
                lifecycleScope.launch {
                    onCommentCountUpdated(postId, commentCount)
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing commentCountUpdate: ${e.message}")
            }
        }

        SocketManager.on("feedUpdate") { data ->
            try {
                val json = data as JSONObject
                val eventType = json.optString("type", json.optString("action"))
                if (eventType == "post_shared") {
                    val postId = json.getString("postId")
                    val shareCount = maxOf(
                        json.optInt("shareCount", 0),
                        json.optInt("sharesCount", 0)
                    )
                    lifecycleScope.launch {
                        onShareCountUpdated(postId, shareCount)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing feedUpdate: ${e.message}")
            }
        }

        SocketManager.on("likeUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val likeCount = json.getInt("likeCount")
                lifecycleScope.launch {
                    val posts = postsProvider()
                    val index = posts.indexOfFirst { it._id == postId }
                    if (index >= 0) {
                        posts[index] = posts[index].copy(likeCount = likeCount)
                        onPostsChanged()
                        onCacheChanged()
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing likeUpdate", e)
            }
        }
    }

    private fun stablePostEventKey(post: Post): String {
        post.logicalPostKey?.takeIf { it.isNotBlank() }?.let { return "logical:$it" }
        post.clientRequestId?.takeIf { it.isNotBlank() }?.let { return "client:${post.userId.id}:$it" }
        post.eventId?.takeIf { it.isNotBlank() }?.let { return "event:$it" }

        val timestampBucket = (FeedTimeUtils.parsePostTimestampMillis(post.createdAt) ?: 0L) / 120_000L
        val mediaKey = listOfNotNull(post.videoUrl, post.audioUrl, post.imageUrl)
            .filter { it.isNotBlank() }
            .plus(post.imageUrls.orEmpty().filter { it.isNotBlank() })
            .joinToString("|")
        val captionKey = post.caption.orEmpty().trim().lowercase(Locale.US)
        if (captionKey.isNotBlank() || mediaKey.isNotBlank()) {
            return listOf(
                "semantic",
                post.userId.id,
                post.communityId?.id.orEmpty(),
                captionKey,
                mediaKey,
                timestampBucket.toString()
            ).joinToString("|")
        }
        if (post._id.isNotBlank()) return "id:${post._id}"
        return listOf(
            post.userId.id,
            post.communityId?.id.orEmpty(),
            captionKey,
            mediaKey,
            timestampBucket.toString()
        ).joinToString("|")
    }
}
