package xyz.yenkasa.app.util

import android.content.Context
import android.util.Log
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.network.ApiClient

object PostNotificationSender {
    private const val TAG = "PostNotificationSender"

    fun sendPostLike(context: Context, post: Post) {
        val actorId = TokenManager.getUserId(context).orEmpty()
        val receiverId = post.userId.id
        if (actorId.isBlank() || receiverId.isBlank() || actorId == receiverId) return

        val actorName = TokenManager.getUsername(context)?.takeIf { it.isNotBlank() } ?: "Someone"
        sendPostNotification(
            context = context,
            receiverId = receiverId,
            type = "post_like",
            message = "$actorName liked your post",
            postId = post._id
        )
    }

    fun sendPostComment(context: Context, post: Post?, postId: String?, commentText: String?) {
        val actorId = TokenManager.getUserId(context).orEmpty()
        val resolvedPostId = post?._id ?: postId.orEmpty()
        if (actorId.isBlank() || resolvedPostId.isBlank()) return

        if (post == null) {
            fetchPostAndSendComment(context.applicationContext, resolvedPostId, commentText)
            return
        }

        val receiverId = post.userId.id
        if (receiverId.isBlank() || actorId == receiverId) return

        val actorName = TokenManager.getUsername(context)?.takeIf { it.isNotBlank() } ?: "Someone"
        val preview = commentText.orEmpty().trim().take(80)
        sendPostNotification(
            context = context,
            receiverId = receiverId,
            type = "post_comment",
            message = if (preview.isBlank()) {
                "$actorName commented on your post"
            } else {
                "$actorName commented: $preview"
            },
            postId = resolvedPostId
        )
    }

    private fun fetchPostAndSendComment(context: Context, postId: String, commentText: String?) {
        val token = TokenManager.getToken(context).orEmpty()
        if (token.isBlank()) return

        ApiClient.apiService.getPostById("Bearer $token", postId)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    val post = response.body()
                    if (response.isSuccessful && post != null) {
                        sendPostComment(context, post, postId, commentText)
                    } else {
                        Log.w(TAG, "Post lookup before comment notification failed: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    Log.w(TAG, "Post lookup before comment notification error: ${t.message}")
                }
            })
    }

    private fun sendPostNotification(
        context: Context,
        receiverId: String,
        type: String,
        message: String,
        postId: String
    ) {
        val token = TokenManager.getToken(context).orEmpty()
        val senderId = TokenManager.getUserId(context).orEmpty()
        if (token.isBlank() || senderId.isBlank()) return

        val body = mapOf(
            "type" to type,
            "senderId" to senderId,
            "receiverId" to receiverId,
            "message" to message,
            "postId" to postId,
            "activityId" to postId,
            "targetType" to "post",
            "targetId" to postId
        )

        enqueueCreateNotification("Bearer $token", body, useFallback = false)
    }

    private fun enqueueCreateNotification(
        auth: String,
        body: Map<String, @JvmSuppressWildcards Any?>,
        useFallback: Boolean
    ) {
        val call = if (useFallback) {
            ApiClient.apiService.createNotificationFallback(auth, body)
        } else {
            ApiClient.apiService.createNotification(auth, body)
        }

        call
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (!response.isSuccessful) {
                        Log.w(TAG, "Notification create failed: ${response.code()}")
                        if (!useFallback && (response.code() == 404 || response.code() == 405)) {
                            enqueueCreateNotification(auth, body, useFallback = true)
                        }
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Log.w(TAG, "Notification create error: ${t.message}")
                }
            })
    }
}
