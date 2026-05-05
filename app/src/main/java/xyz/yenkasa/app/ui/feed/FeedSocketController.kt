package xyz.yenkasa.app.ui.feed

import android.util.Log
import androidx.lifecycle.LifecycleCoroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.network.SocketManager

class FeedSocketController(
    private val lifecycleScope: LifecycleCoroutineScope,
    private val postsProvider: () -> MutableList<Post>,
    private val onPostsChanged: () -> Unit,
    private val onCacheChanged: () -> Unit,
    private val onScrollToTop: () -> Unit,
    private val onViewCountUpdated: (String, Int) -> Unit
) {
    fun connect(userId: String?) {
        SocketManager.ensureConnected(userId)
        setupSocketListeners()
    }

    fun detach() {
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
        SocketManager.off("viewUpdate")
    }

    private fun setupSocketListeners() {
        SocketManager.on("newPost") { data ->
            try {
                val newPost = Post.fromJson(data as JSONObject)
                lifecycleScope.launch {
                    postsProvider().add(0, newPost)
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
                val viewsCount = json.getInt("viewsCount")
                lifecycleScope.launch {
                    onViewCountUpdated(postId, viewsCount)
                }
            } catch (e: Exception) {
                Log.e("FeedSocketController", "Error parsing viewUpdate: ${e.message}")
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
}
