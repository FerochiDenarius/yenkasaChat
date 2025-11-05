package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object FeedUtils {

    // 🔹 Toggle Like / Unlike
    fun toggleLike(
        context: Context,
        token: String,
        post: Post,
        onLikeUpdated: (liked: Boolean, likeCount: Int) -> Unit
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
                    } else {
                        Log.w(
                            "FeedUtils",
                            "⚠️ Like failed -> code=${response.code()}, msg=${response.message()}"
                        )
                        Toast.makeText(context, "Failed to like post", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<LikeResponse>, t: Throwable) {
                    Log.e("FeedUtils", "❌ Like toggle error: ${t.message}", t)
                    Toast.makeText(context, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }



    // 🔹 Share post
    fun sharePost(context: Context, post: Post) {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND)
            shareIntent.type = "text/plain"
            shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post on Yenkasa")
            shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption)
            context.startActivity(Intent.createChooser(shareIntent, "Share via"))
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(context, "Error sharing post", Toast.LENGTH_SHORT).show()
        }
    }

    // 🔹 Follow / Unfollow logic
    fun toggleFollow(
        context: Context,
        token: String,
        targetUserId: String,
        isFollowing: Boolean,
        onComplete: (() -> Unit)? = null
    ) {
        val call = if (isFollowing) {
            ApiClient.apiService.unfollowUser(targetUserId, "Bearer $token")
        } else {
            ApiClient.apiService.followUser(targetUserId, "Bearer $token")
        }

        call.enqueue(object : Callback<FollowResponse> {
            override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    Toast.makeText(context, body.message, Toast.LENGTH_SHORT).show()
                    onComplete?.invoke()
                } else {
                    Toast.makeText(context, "Failed to follow/unfollow", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                Log.e("FeedUtils", "❌ Follow/unfollow failed: ${t.message}", t)
                Toast.makeText(context, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // 🔹 Block / Unblock logic
    fun toggleBlock(
        context: Context,
        token: String,
        targetUserId: String,
        onComplete: ((blockedBy: String, blockedUser: String) -> Unit)? = null
    ) {
        ApiClient.apiService.blockUser("Bearer $token", targetUserId)
            .enqueue(object : Callback<BlockResponse> {
                override fun onResponse(call: Call<BlockResponse>, response: Response<BlockResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        Toast.makeText(context, body.message, Toast.LENGTH_SHORT).show()

                        // ✅ Update local encrypted list of blocked users
                        if (body.message.contains("blocked", true)) {
                            TokenManager.addBlockedUser(context, body.blockedUserId)
                        } else if (body.message.contains("unblocked", true)) {
                            TokenManager.removeBlockedUser(context, body.blockedUserId)
                        }

                        // Optional: invoke completion callback
                        onComplete?.invoke(body.userId, body.blockedUserId)

                    } else {
                        Toast.makeText(context, "Failed to block/unblock", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<BlockResponse>, t: Throwable) {
                    Log.e("FeedUtils", "❌ Block/unblock failed: ${t.message}", t)
                    Toast.makeText(context, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
