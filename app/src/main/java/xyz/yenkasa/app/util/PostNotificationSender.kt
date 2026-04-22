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
        val receiverId = post?.userId?.id.orEmpty()
        val resolvedPostId = post?._id ?: postId.orEmpty()
        if (actorId.isBlank() || receiverId.isBlank() || resolvedPostId.isBlank() || actorId == receiverId) return

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

        ApiClient.apiService.createNotification("Bearer $token", body)
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (!response.isSuccessful) {
                        Log.w(TAG, "Notification create failed: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Log.w(TAG, "Notification create error: ${t.message}")
                }
            })
    }
}
