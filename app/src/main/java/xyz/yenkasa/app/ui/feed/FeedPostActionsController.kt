package xyz.yenkasa.app.ui.feed

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.bottomsheet.BottomSheetDialog
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.FlagRequest
import xyz.yenkasa.app.model.GenericResponse
import xyz.yenkasa.app.model.MediaResponse
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.CommentsActivity
import xyz.yenkasa.app.ui.FeedUtils
import xyz.yenkasa.app.ui.PostMediaActivity
import xyz.yenkasa.app.ui.UserProfileActivity
import xyz.yenkasa.app.util.TokenManager

class FeedPostActionsController(
    private val fragment: Fragment,
    private val tokenProvider: () -> String?,
    private val postsProvider: () -> MutableList<Post>,
    private val onPostsChanged: () -> Unit,
    private val onCacheChanged: () -> Unit
) {
    fun handleLike(post: Post, position: Int) {
        val context = fragment.requireContext()
        val authToken = TokenManager.getToken(context) ?: return
        val posts = postsProvider()
        if (posts.isEmpty()) return

        val adapterPosition = position.coerceIn(0, posts.lastIndex)
        val previousPost = posts.getOrNull(adapterPosition) ?: return
        posts[adapterPosition] = previousPost.copy(
            likedByUser = !previousPost.likedByUser,
            likeCount = if (previousPost.likedByUser) {
                (previousPost.likeCount - 1).coerceAtLeast(0)
            } else {
                previousPost.likeCount + 1
            }
        )
        onPostsChanged()
        onCacheChanged()

        FeedUtils.toggleLike(context, authToken, previousPost, { liked, newLikeCount ->
            posts[adapterPosition] = post.copy(
                likedByUser = liked,
                likeCount = newLikeCount
            )
            onPostsChanged()
            onCacheChanged()
        }, onError = {
            posts[adapterPosition] = previousPost
            fragment.viewLifecycleOwner.lifecycleScope.launchWhenStarted {
                onPostsChanged()
                onCacheChanged()
            }
        })
    }

    fun openComments(post: Post) {
        fragment.startActivity(
            Intent(fragment.requireContext(), CommentsActivity::class.java).apply {
                putExtra("POST_ID", post._id)
            }
        )
    }

    fun openUserProfile(userId: String) {
        fragment.startActivity(
            Intent(fragment.requireContext(), UserProfileActivity::class.java).apply {
                putExtra("USER_ID", userId)
            }
        )
    }

    fun openMedia(post: Post) {
        when {
            !post.videoUrl.isNullOrEmpty() -> openMedia(post, post.videoUrl, "video")
            !post.audioUrl.isNullOrEmpty() -> openMedia(post, post.audioUrl, "audio")
            post.effectiveImageUrls().isNotEmpty() -> openMedia(post, post.effectiveImageUrls().firstOrNull(), "image")
        }
    }

    fun sharePost(post: Post) {
        val shareUrl = "https://www.yenkasa.xyz/web/post/${post._id}"
        val shareText = listOfNotNull(
            post.caption?.takeIf { it.isNotBlank() },
            shareUrl
        ).joinToString("\n\n").ifBlank { shareUrl }

        tokenProvider()?.takeIf { it.isNotBlank() }?.let { authToken ->
            ApiClient.apiService.recordPostShare(post._id, "Bearer $authToken")
                .enqueue(object : Callback<GenericResponse> {
                    override fun onResponse(
                        call: Call<GenericResponse>,
                        response: Response<GenericResponse>
                    ) = Unit

                    override fun onFailure(call: Call<GenericResponse>, t: Throwable) = Unit
                })
        }

        fragment.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, fragment.getString(R.string.share_post_subject))
                    putExtra(Intent.EXTRA_TEXT, shareText)
                },
                fragment.getString(R.string.share_via)
            )
        )
    }

    fun showPostOptionsBottomSheet(post: Post) {
        val bottomSheet = BottomSheetDialog(fragment.requireContext())
        val view = LayoutInflater.from(fragment.requireContext())
            .inflate(R.layout.bottomsheet_post_options, null)
        val optionDelete = view.findViewById<TextView>(R.id.optionDelete)
        val optionHide = view.findViewById<TextView>(R.id.optionHide)
        val optionDownload = view.findViewById<TextView>(R.id.optionDownload)
        val optionFlag = view.findViewById<TextView>(R.id.optionFlag)
        val currentUserId = TokenManager.getUserId(fragment.requireContext())

        optionDelete.visibility = if (post.userId.id == currentUserId) android.view.View.VISIBLE else android.view.View.GONE
        optionDelete.setOnClickListener {
            bottomSheet.dismiss()
            confirmDeletePost(post)
        }
        optionHide.setOnClickListener {
            bottomSheet.dismiss()
            hidePost(post)
        }
        optionDownload.setOnClickListener {
            bottomSheet.dismiss()
            downloadPost(post)
        }
        optionFlag.setOnClickListener {
            bottomSheet.dismiss()
            flagPost(post)
        }

        bottomSheet.setContentView(view)
        bottomSheet.show()
    }

    private fun openMedia(post: Post, url: String?, type: String) {
        fragment.startActivity(
            Intent(fragment.requireContext(), PostMediaActivity::class.java).apply {
                putExtra("MEDIA_URL", url)
                putExtra("MEDIA_TYPE", type)
                putExtra("POST_ID", post._id)
                putExtra("USERNAME", post.userId.username)
                putExtra("CAPTION", post.caption ?: "")
            }
        )
    }

    fun confirmDeletePost(post: Post) {
        AlertDialog.Builder(fragment.requireContext())
            .setTitle(R.string.delete_post)
            .setMessage(R.string.delete_post_confirmation)
            .setPositiveButton(R.string.delete) { _, _ -> deletePost(post) }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    fun downloadPost(post: Post) {
        ApiClient.apiService.getPostMedia(post._id, "Bearer ${tokenProvider()}")
            .enqueue(object : Callback<MediaResponse> {
                override fun onResponse(
                    call: Call<MediaResponse>,
                    response: Response<MediaResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        Toast.makeText(fragment.requireContext(), R.string.failed_to_get_media, Toast.LENGTH_SHORT).show()
                        return
                    }

                    val media = response.body()?.media
                    val url = media?.firstImageUrl() ?: media?.videoUrl ?: media?.audioUrl
                    if (url.isNullOrEmpty()) {
                        Toast.makeText(fragment.requireContext(), R.string.no_media_found, Toast.LENGTH_SHORT).show()
                        return
                    }

                    fragment.startActivity(
                        Intent(Intent.ACTION_VIEW).apply { data = Uri.parse(url) }
                    )
                }

                override fun onFailure(call: Call<MediaResponse>, t: Throwable) {
                    Toast.makeText(fragment.requireContext(), R.string.download_failed, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun deletePost(post: Post) {
        ApiClient.apiService.deletePost(post._id, "Bearer ${tokenProvider()}")
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(
                    call: Call<GenericResponse>,
                    response: Response<GenericResponse>
                ) {
                    if (response.isSuccessful) {
                        postsProvider().removeAll { it._id == post._id }
                        onPostsChanged()
                        onCacheChanged()
                        Toast.makeText(fragment.requireContext(), R.string.post_deleted, Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(fragment.requireContext(), R.string.delete_failed, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(fragment.requireContext(), R.string.network_error, Toast.LENGTH_SHORT).show()
                }
            })
    }

    fun hidePost(post: Post) {
        ApiClient.apiService.hidePost(post._id, "Bearer ${tokenProvider()}")
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(
                    call: Call<GenericResponse>,
                    response: Response<GenericResponse>
                ) {
                    postsProvider().removeAll { it._id == post._id }
                    onPostsChanged()
                    onCacheChanged()
                    Toast.makeText(fragment.requireContext(), R.string.post_hidden, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(fragment.requireContext(), R.string.failed_to_hide_post, Toast.LENGTH_SHORT).show()
                }
            })
    }

    fun flagPost(post: Post) {
        ApiClient.apiService.flagPost(
            post._id,
            "Bearer ${tokenProvider()}",
            FlagRequest(reason = "inappropriate")
        ).enqueue(object : Callback<GenericResponse> {
            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                Toast.makeText(
                    fragment.requireContext(),
                    if (response.isSuccessful) {
                        fragment.getString(R.string.post_reported_successfully)
                    } else {
                        fragment.getString(R.string.failed_to_report_post)
                    },
                    Toast.LENGTH_SHORT
                ).show()
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(
                    fragment.requireContext(),
                    fragment.getString(R.string.report_failed_with_message, t.message ?: fragment.getString(R.string.unknown_error)),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }
}
