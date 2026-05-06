package xyz.yenkasa.app.ui

import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import xyz.yenkasa.app.model.*
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.PostNotificationSender
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object FeedUtils {

    // 🔹 Toggle Like / Unlike
    fun toggleLike(
        context: Context,
        token: String,
        post: Post,
        onLikeUpdated: (liked: Boolean, likeCount: Int) -> Unit,
        onError: (() -> Unit)? = null
    ) {
        ApiClient.apiService.toggleLike("Bearer $token", post._id)
            .enqueue(object : Callback<LikeResponse> {
                override fun onResponse(call: Call<LikeResponse>, response: Response<LikeResponse>) {
                    Log.d("FeedUtils", "📡 Like API called for postId=${post._id}")

                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        Log.d(
                            "FeedUtils",
                            "❤️ Like toggled -> liked=${body.likedByUser}, count=${body.likeCount}"
                        )

                        onLikeUpdated(body.likedByUser, body.likeCount)
                        if (body.likedByUser) {
                            PostNotificationSender.sendPostLike(context, post)
                        }
                    } else {
                        Log.w(
                            "FeedUtils",
                            "⚠️ Like failed -> code=${response.code()}, msg=${response.message()}"
                        )
                        onError?.invoke()
                        Toast.makeText(context, "Failed to like post", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<LikeResponse>, t: Throwable) {
                    Log.e("FeedUtils", "❌ Like toggle error: ${t.message}", t)
                    onError?.invoke()
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }



    // 🔹 Share post
    fun sharePost(context: Context, post: Post) {
        try {
            TokenManager.getToken(context)?.takeIf { it.isNotBlank() }?.let { token ->
                ApiClient.apiService.recordPostShare(post._id, "Bearer $token")
                    .enqueue(object : Callback<GenericResponse> {
                        override fun onResponse(
                            call: Call<GenericResponse>,
                            response: Response<GenericResponse>
                        ) {
                            if (!response.isSuccessful) {
                                Log.w("FeedUtils", "Failed to record share for ${post._id}: ${response.code()}")
                            }
                        }

                        override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                            Log.w("FeedUtils", "Failed to record share for ${post._id}: ${t.message}")
                        }
                    })
            }

            val shareUrl = "https://www.yenkasa.xyz/web/post/${post._id}"
            val shareText = listOfNotNull(
                post.caption?.takeIf { it.isNotBlank() },
                shareUrl
            ).joinToString("\n\n").ifBlank { shareUrl }

            val shareIntent = Intent(Intent.ACTION_SEND)
            shareIntent.type = "text/plain"
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post on Yenkasa")
            shareIntent.putExtra(Intent.EXTRA_TEXT, shareText)
            context.startActivity(Intent.createChooser(shareIntent, "Share via"))
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Error sharing post", Toast.LENGTH_SHORT).show()
        }
    }



    fun deletePost(
        context: Context,
        token: String,
        postId: String,
        onDeleted: (() -> Unit)? = null
    ) {
        ApiClient.apiService.deletePost(postId, "Bearer $token")
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(
                    call: Call<GenericResponse>,
                    response: Response<GenericResponse>
                ) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(context, "Post deleted", Toast.LENGTH_SHORT).show()
                        onDeleted?.invoke()
                    } else {
                        Toast.makeText(context, "Failed to delete post", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    fun hidePost(
        context: Context,
        token: String,
        postId: String,
        onHidden: (() -> Unit)? = null
    ) {
        ApiClient.apiService.hidePost(postId, "Bearer $token")
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(
                    call: Call<GenericResponse>,
                    response: Response<GenericResponse>
                ) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(context, "Post hidden", Toast.LENGTH_SHORT).show()
                        onHidden?.invoke()
                    } else {
                        Toast.makeText(context, "Failed to hide post", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    fun downloadMedia(
        context: Context,
        token: String,
        postId: String
    ) {
        ApiClient.apiService.getPostMedia(postId, "Bearer $token")
            .enqueue(object : Callback<MediaResponse> {
                override fun onResponse(
                    call: Call<MediaResponse>,
                    response: Response<MediaResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        Toast.makeText(context, "Unable to get media", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val media = response.body()!!.media
                    val url = media.firstImageUrl() ?: media.videoUrl ?: media.audioUrl ?: return

                    val intent = Intent(Intent.ACTION_VIEW)
                    intent.setDataAndType(android.net.Uri.parse(url), "*/*")
                    context.startActivity(intent)
                }

                override fun onFailure(call: Call<MediaResponse>, t: Throwable) {
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    fun flagPost(
        context: Context,
        token: String,
        postId: String,
        reason: String = "inappropriate",
        onFlagged: (() -> Unit)? = null
    ) {
        ApiClient.apiService.flagPost(
            postId,
            "Bearer $token",
            FlagRequest(reason)
        ).enqueue(object : Callback<GenericResponse> {
            override fun onResponse(call: Call<GenericResponse>, response: Response<GenericResponse>) {
                if (response.isSuccessful && response.body()?.success == true) {
                    Toast.makeText(context, "Reported successfully", Toast.LENGTH_SHORT).show()
                    onFlagged?.invoke()
                } else {
                    Toast.makeText(context, "Failed to report", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(context, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }


}
