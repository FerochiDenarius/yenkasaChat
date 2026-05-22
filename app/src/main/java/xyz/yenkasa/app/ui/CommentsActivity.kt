package xyz.yenkasa.app.ui

import android.net.Uri
import android.os.Bundle
import android.graphics.Rect
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import com.google.gson.Gson
import xyz.yenkasa.app.model.CommentsResponse
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.CommentAdapter
import xyz.yenkasa.app.model.Comment
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.AppLinkManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager
import kotlinx.coroutines.*
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.view.animation.BounceInterpolator
import android.view.animation.ScaleAnimation
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import android.content.Intent
import xyz.yenkasa.app.adapter.PostHeaderAdapter
import androidx.recyclerview.widget.ConcatAdapter




class CommentsActivity : AppCompatActivity() {
    companion object {
        const val EXTRA_RESULT_POST_ID = "extra_result_post_id"
        const val EXTRA_RESULT_COMMENT_COUNT = "extra_result_comment_count"
    }


    private lateinit var recyclerComments: RecyclerView
    private lateinit var editComment: EditText
    private lateinit var buttonSend: ImageButton
    private lateinit var adapter: CommentAdapter
    private val comments = mutableListOf<Comment>()
    private lateinit var postHeaderAdapter: PostHeaderAdapter
    private var postId: String? = null
    private var isRefreshing = false
    private var autoRefreshJob: Job? = null
    private var latestCommentCount: Int? = null
    private var currentPost: Post? = null
    private var deepLinkMediaOpened = false
    private val pendingCommentLikeIds = mutableSetOf<String>()
    // Post header root
    private lateinit var postHeaderView: View

    private lateinit var currentUserId: String
    private lateinit var accessToken: String


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        )
        setContentView(R.layout.activity_comments)

        // 1️⃣ RecyclerView
        recyclerComments = findViewById(R.id.recyclerComments)


// 2️⃣ Inflate post header ONCE
        postHeaderView = layoutInflater.inflate(
            R.layout.item_post,
            null,
            false
        )
        postHeaderView.layoutParams = RecyclerView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        postHeaderAdapter = PostHeaderAdapter(postHeaderView) { userId ->
            startActivity(
                Intent(this, UserProfileActivity::class.java)
                    .putExtra("USER_ID", userId)
            )
        }



        accessToken = TokenManager.getToken(this) ?: ""
        currentUserId = TokenManager.getUserId(this) ?: ""


        // Initialize views
        editComment = findViewById(R.id.editComment)
        buttonSend = findViewById(R.id.buttonSend)


        val buttonBack = findViewById<ImageButton>(R.id.buttonBack)
        buttonBack.setOnClickListener { onBackPressedDispatcher.onBackPressed() }

        // ✅ Initialize adapter with CommentActionListener
        adapter = CommentAdapter(this, comments, object : CommentAdapter.CommentActionListener {


            // This MUST exist
            override fun onLike(comment: Comment, isLiked: Boolean, position: Int) {
                toggleCommentLike(comment, isLiked, position)

            }

            override fun onUserClicked(userId: String) {
                val intent = Intent(this@CommentsActivity, UserProfileActivity::class.java)
                intent.putExtra("USER_ID", userId)
                startActivity(intent)
            }

            // 🗨️ Reply to a comment
            override fun onReply(comment: Comment) {
                editComment.setText("@${comment.user?.username ?: ""} ")
                editComment.requestFocus()

                val parentCommentId = comment._id

                buttonSend.setOnClickListener {
                    val text = editComment.text.toString().trim()
                    if (text.isEmpty()) return@setOnClickListener

                    val json = JSONObject().apply {
                        put("postId", postId)
                        put("text", text)
                        put("parentCommentId", parentCommentId)
                    }.toString()

                    val body = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                    val token = TokenManager.getToken(this@CommentsActivity) ?: return@setOnClickListener

                    ApiClient.apiService.addComment("Bearer $token", body)
                        .enqueue(object : Callback<Map<String, Any>> {
                            override fun onResponse(
                                call: Call<Map<String, Any>>,
                                response: Response<Map<String, Any>>
                            ) {
                                if (response.isSuccessful && response.body() != null) {
                                    val map = response.body()!!
                                    val success = map["success"] as? Boolean ?: false
                                    if (success) {
                                        val commentJson = Gson().toJson(map["comment"])
                                        val newComment = Gson().fromJson(commentJson, Comment::class.java)
                                        handleRewardPayload(map)

                                        editComment.text.clear()
                                        Toast.makeText(this@CommentsActivity, R.string.reply_posted, Toast.LENGTH_SHORT).show()
                                        loadComments()
                                        resetSendButton()

                                        Log.d("CommentsActivity", "✅ Added reply: ${newComment.text}")
                                    } else {
                                        Toast.makeText(this@CommentsActivity, map["message"].toString(), Toast.LENGTH_SHORT).show()
                                    }
                                } else {
                                    Toast.makeText(this@CommentsActivity, R.string.failed_to_post_reply, Toast.LENGTH_SHORT).show()
                                }
                            }

                            override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                                Toast.makeText(
                                    this@CommentsActivity,
                                    getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        })
                }

                recyclerComments.scrollToPosition(comments.size - 1)
            }

            // ✏️ Edit a comment
            override fun onEdit(comment: Comment) {
                editComment.setText(comment.text ?: "")
                editComment.requestFocus()

                // Always reset the button to normal state before setting new listener
                buttonSend.setOnClickListener(null)
                buttonSend.setOnClickListener {
                    val newText = editComment.text.toString().trim()
                    if (newText.isEmpty()) return@setOnClickListener

                    val json = "{\"text\":\"${newText}\"}"
                    val body = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                    val token = TokenManager.getToken(this@CommentsActivity) ?: return@setOnClickListener

                    // 🧠 Debug log: check if this ID really exists in backend
                    Log.d("EditComment", "Editing comment with ID: ${comment._id}")

                    ApiClient.apiService.editComment("Bearer $token", comment._id, body)
                        .enqueue(object : Callback<Map<String, Any>> {
                            override fun onResponse(
                                call: Call<Map<String, Any>>,
                                response: Response<Map<String, Any>>
                            ) {
                                if (response.isSuccessful && response.body() != null) {
                                    val map = response.body()!!
                                    val success = map["success"] as? Boolean ?: false

                                    if (response.isSuccessful) {
                                        val data = response.body()
                                        if (data != null && data["success"] == true) {
                                            // ✅ Normal success path
                                            val gson = Gson()
                                            val commentJson = gson.toJson(data["comment"])
                                            val comment = gson.fromJson(commentJson, Comment::class.java)
                                            runOnUiThread {
                                                Toast.makeText(this@CommentsActivity, R.string.comment_added, Toast.LENGTH_SHORT).show()
                                                loadComments()
                                                editComment.text.clear()
                                            }
                                        } else {
                                            // ✅ Success HTTP but unexpected JSON
                                            Log.w("PostComment", "Unexpected response structure: $data")
                                            Toast.makeText(this@CommentsActivity, R.string.comment_added_response_unparsed, Toast.LENGTH_SHORT).show()
                                            loadComments()
                                        }
                                    } else {
                                        Toast.makeText(
                                            this@CommentsActivity,
                                            getString(R.string.failed_to_post_comment_code, response.code()),
                                            Toast.LENGTH_SHORT
                                        ).show()
                                    }


                                } else {
                                    val code = response.code()
                                    val error = response.errorBody()?.string()
                                    Log.e("EditComment", "Failed → $code | $error")
                                    Toast.makeText(
                                        this@CommentsActivity,
                                        getString(R.string.failed_to_update_comment_code, code),
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            }

                            override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                                Log.e("EditComment", "Error → ${t.message}", t)
                                Toast.makeText(
                                    this@CommentsActivity,
                                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        })
                }

                recyclerComments.scrollToPosition(comments.indexOf(comment))
            }


            // 🗑️ Delete a comment
            override fun onDelete(comment: Comment) {
                val token = TokenManager.getToken(this@CommentsActivity) ?: return

                ApiClient.apiService.deleteComment("Bearer $token", comment._id)
                    .enqueue(object : Callback<Map<String, Any>> {
                        override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                            if (response.isSuccessful && response.body() != null) {
                                val map = response.body()!!
                                val success = map["success"] as? Boolean ?: false
                                if (success) {
                                    adapter.deleteComment(comment)
                                    Toast.makeText(this@CommentsActivity, R.string.comment_deleted, Toast.LENGTH_SHORT).show()
                                    loadComments()
                                } else {
                                    Toast.makeText(this@CommentsActivity, map["message"].toString(), Toast.LENGTH_SHORT).show()
                                }
                            } else {
                                Toast.makeText(this@CommentsActivity, R.string.failed_to_delete_comment, Toast.LENGTH_SHORT).show()
                            }
                        }

                        override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                            Toast.makeText(
                                this@CommentsActivity,
                                getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    })
            }
        })

        recyclerComments.layoutManager = LinearLayoutManager(this)
        recyclerComments.adapter = ConcatAdapter(
            postHeaderAdapter,
            adapter // CommentAdapter
        )
        recyclerComments.isNestedScrollingEnabled = false



        postId = intent.getStringExtra("POST_ID")
        if (postId.isNullOrEmpty()) {
            Toast.makeText(this, R.string.post_not_found, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Load post and comments
        loadPostDetails()
        loadComments()
        setupKeyboardAwareCommentInput()

        buttonSend.setOnClickListener {
            val text = editComment.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, R.string.enter_comment, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            postComment(text)
        }
    }

    private fun setupKeyboardAwareCommentInput() {
        val commentsRoot = findViewById<View>(R.id.commentsRoot)
        val commentInputLayout = findViewById<View>(R.id.layoutCommentInput)
        val replyPreviewLayout = findViewById<View>(R.id.layoutReplyPreview)
        val originalRecyclerBottomPadding = recyclerComments.paddingBottom
        var wasKeyboardVisible = false

        ViewCompat.setOnApplyWindowInsetsListener(commentsRoot) { _, insets ->
            val isKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val keyboardOffset = if (isKeyboardVisible) getKeyboardOverlapHeight() else 0
            val translationY = -keyboardOffset.toFloat()

            commentInputLayout.translationY = translationY
            replyPreviewLayout.translationY = translationY
            recyclerComments.setPadding(
                recyclerComments.paddingLeft,
                recyclerComments.paddingTop,
                recyclerComments.paddingRight,
                originalRecyclerBottomPadding + keyboardOffset
            )

            if (isKeyboardVisible && !wasKeyboardVisible) {
                scrollCommentsAboveKeyboard()
            }
            wasKeyboardVisible = isKeyboardVisible

            insets
        }
        ViewCompat.requestApplyInsets(commentsRoot)

        editComment.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) scrollCommentsAboveKeyboard()
        }
        editComment.setOnClickListener {
            scrollCommentsAboveKeyboard()
        }
    }

    private fun getKeyboardOverlapHeight(): Int {
        val commentsRoot = findViewById<View>(R.id.commentsRoot)
        val visibleFrame = Rect()
        commentsRoot.getWindowVisibleDisplayFrame(visibleFrame)

        val rootLocation = IntArray(2)
        commentsRoot.getLocationOnScreen(rootLocation)
        val rootBottom = rootLocation[1] + commentsRoot.height

        return (rootBottom - visibleFrame.bottom).coerceAtLeast(0)
    }

    private fun scrollCommentsAboveKeyboard() {
        recyclerComments.postDelayed({
            val totalItems = recyclerComments.adapter?.itemCount ?: 0
            if (totalItems > 1) {
                recyclerComments.smoothScrollToPosition(totalItems - 1)
            } else {
                recyclerComments.smoothScrollBy(0, (postHeaderView.height * 0.35f).toInt().coerceAtLeast(180))
            }
        }, 250)
    }

    override fun onResume() {
        super.onResume()
        startAutoRefresh()
    }

    override fun onPause() {
        super.onPause()
        stopAutoRefresh()
    }

    override fun finish() {
        val resolvedPostId = postId
        if (!resolvedPostId.isNullOrBlank()) {
            setResult(
                RESULT_OK,
                Intent().apply {
                    putExtra(EXTRA_RESULT_POST_ID, resolvedPostId)
                    putExtra(
                        EXTRA_RESULT_COMMENT_COUNT,
                        latestCommentCount ?: comments.size
                    )
                }
            )
        }
        super.finish()
    }

    private fun startAutoRefresh() {
        if (autoRefreshJob?.isActive == true) return
        autoRefreshJob = CoroutineScope(Dispatchers.Main).launch {
            while (isActive) {
                loadComments(autoRefresh = true)
                delay(15000)
            }
        }
    }

    private fun stopAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = null
    }


    private fun loadComments(autoRefresh: Boolean = false) {
        if (isRefreshing) return
        isRefreshing = true

        val token = TokenManager.getToken(this)
        val id = postId
        if (token.isNullOrEmpty() || id.isNullOrEmpty()) {
            isRefreshing = false
            return
        }

        ApiClient.apiService.getComments(
            token = "Bearer $token",
            postId = id,
            page = 1,
            limit = 50
        ).enqueue(object : Callback<CommentsResponse> {
            override fun onResponse(call: Call<CommentsResponse>, response: Response<CommentsResponse>) {
                isRefreshing = false
                if (response.isSuccessful && response.body() != null) {
                    val newComments = response.body()!!.comments
                    comments.clear()
                    comments.addAll(newComments)
                    adapter.notifyDataSetChanged()
                    latestCommentCount = newComments.size

                    // ✅ UPDATE COMMENT COUNT IN HEADER (HERE)
                    postHeaderAdapter.updateCommentCount(newComments.size)

                    // ✅ Safe scroll
                    if (comments.isNotEmpty()) {
                        recyclerComments.scrollToPosition(comments.lastIndex)
                    }
                } else {
                    Log.e("CommentsActivity", "Failed to load comments: ${response.code()} | ${response.errorBody()?.string()}")
                    if (!autoRefresh) {
                        Toast.makeText(
                            this@CommentsActivity,
                            getString(R.string.failed_to_load_comments_code, response.code()),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            }

            override fun onFailure(call: Call<CommentsResponse>, t: Throwable) {
                isRefreshing = false
                Log.e("CommentsActivity", "Network error fetching comments", t)
                if (!autoRefresh) {
                    Toast.makeText(
                        this@CommentsActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        })
    }

    private fun resetPostMedia(header: View) {
        header.findViewById<ImageView>(R.id.imagePostContent).visibility = View.GONE
        header.findViewById<YenkasaVideoPlayerView>(R.id.playerView).apply {
            release()
            visibility = View.GONE
        }
        header.findViewById<ImageView>(R.id.imageVideoThumbnail)?.visibility = View.GONE
        header.findViewById<ImageButton>(R.id.btnVideoPlay)?.visibility = View.GONE
        header.findViewById<LinearLayout>(R.id.audioIcon).visibility = View.GONE
    }

    private fun postComment(text: String) {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, R.string.please_log_in_first, Toast.LENGTH_SHORT).show()
            return
        }

        val json = JSONObject().apply {
            put("postId", postId)
            put("text", text)
        }.toString()

        val body: RequestBody = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        ApiClient.apiService.addComment("Bearer $token", body)
            .enqueue(object : retrofit2.Callback<Map<String, Any>> {
                override fun onResponse(
                    call: Call<Map<String, Any>>,
                    response: Response<Map<String, Any>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        try {
                            val data = response.body()!!
                            val gson = com.google.gson.Gson()

                            // Extract the nested "comment" object
                            val commentJson = gson.toJson(data["comment"])
                            val comment = gson.fromJson(commentJson, Comment::class.java)
                            handleRewardPayload(data)

                            runOnUiThread {
                                Toast.makeText(
                                    this@CommentsActivity,
                                    getString(R.string.comment_added),
                                    Toast.LENGTH_SHORT
                                ).show()

                                // Optionally update RecyclerView
                                // commentsAdapter.addComment(comment)
                                loadComments()
                                resetSendButton()
                                editComment.text.clear()
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            runOnUiThread {
                                Toast.makeText(
                                    this@CommentsActivity,
                                    getString(R.string.failed_to_parse_comment_response),
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    } else {
                        runOnUiThread {
                            Toast.makeText(
                                this@CommentsActivity,
                                getString(R.string.failed_to_post_comment),
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    runOnUiThread {
                        Toast.makeText(
                            this@CommentsActivity,
                            getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            })
    }

    // Optional: comment success animation
    private fun animateCommentSuccess() {
        val anim = ScaleAnimation(
            0.8f, 1f, 0.8f, 1f,
            ScaleAnimation.RELATIVE_TO_SELF, 0.5f,
            ScaleAnimation.RELATIVE_TO_SELF, 0.5f
        )
        anim.duration = 300
        anim.interpolator = BounceInterpolator()
        buttonSend.startAnimation(anim)
    }

    //======Toggle Like on Comment=========//
    private fun toggleCommentLike(comment: Comment, isLiked: Boolean, position: Int) {
        val token = TokenManager.getToken(this) ?: run {
            Toast.makeText(this, R.string.please_log_in_first, Toast.LENGTH_SHORT).show()
            return
        }

        val userId = currentUserId.takeIf { it.isNotBlank() }
            ?: TokenManager.getUserId(this)
            ?: run {
                Toast.makeText(this, R.string.please_log_in_first, Toast.LENGTH_SHORT).show()
                return
            }

        if (!pendingCommentLikeIds.add(comment._id)) return

        val commentIndex = comments.indexOfFirst { it._id == comment._id }
            .takeIf { it >= 0 }
            ?: position.takeIf { it in comments.indices }
            ?: run {
                pendingCommentLikeIds.remove(comment._id)
                return
            }

        val originalComment = comments[commentIndex]
        val updatedLikes = originalComment.likes.toMutableList()

        if (isLiked) {
            if (!updatedLikes.contains(userId)) updatedLikes.add(userId)
        } else {
            updatedLikes.remove(userId)
        }

        val updatedComment = originalComment.copy(
            likes = updatedLikes,
            likeCount = updatedLikes.size
        )

        comments[commentIndex] = updatedComment
        adapter.notifyItemChanged(commentIndex)

        // 2️⃣ Call API
        val json = JSONObject().apply {
            put("commentId", comment._id)
            put("like", isLiked)
        }.toString()

        val body = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        ApiClient.apiService.likeComment("Bearer $token", body)
            .enqueue(object : retrofit2.Callback<Map<String, Any>> {
                override fun onResponse(
                    call: Call<Map<String, Any>>,
                    response: Response<Map<String, Any>>
                ) {
                    pendingCommentLikeIds.remove(comment._id)
                    if (response.isSuccessful && response.body() != null) {
                        // ✅ Use server value to fully sync
                        val data = response.body()
                        val serverLikeCount = parseInt(data?.get("likeCount"), updatedLikes.size)
                        val likesArray = parseStringList(data?.get("likes"))
                        val rewardAmount = parseDouble(data?.get("rewardAmount"), 0.0)
                        val newBalance = parseNullableDouble(data?.get("newBalance"))
                        if (isLiked && rewardAmount > 0.0) {
                            if (newBalance != null) {
                                WalletBalanceManager.applyKnownBalance(
                                    this@CommentsActivity,
                                    newBalance,
                                    rewardAmount = rewardAmount
                                )
                            } else {
                                WalletBalanceManager.refreshAfterReward(this@CommentsActivity, rewardAmount)
                            }
                        }

                        // Create another copy with server-corrected values
                        val syncedComment = updatedComment.copy(
                            likes = likesArray ?: updatedLikes,
                            likeCount = serverLikeCount
                        )

                        updateCommentById(syncedComment)
                        Log.d("LikeComment", "✅ Synced with server")
                    } else {
                        // Revert in case of failure
                        updateCommentById(originalComment)
                        Toast.makeText(this@CommentsActivity, R.string.failed_to_update_like, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    pendingCommentLikeIds.remove(comment._id)
                    // Revert in case of network failure
                    updateCommentById(originalComment)
                    Toast.makeText(
                        this@CommentsActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun updateCommentById(updatedComment: Comment) {
        val index = comments.indexOfFirst { it._id == updatedComment._id }
        if (index == -1) return

        comments[index] = updatedComment
        adapter.notifyItemChanged(index)
    }

    private fun handleRewardPayload(data: Map<String, Any>?) {
        val rewardAmount = parseDouble(data?.get("rewardAmount"), 0.0)
        if (rewardAmount <= 0.0) return
        val newBalance = parseNullableDouble(data?.get("newBalance"))
        if (newBalance != null) {
            WalletBalanceManager.applyKnownBalance(this, newBalance, rewardAmount = rewardAmount)
        } else {
            WalletBalanceManager.refreshAfterReward(this, rewardAmount)
        }
    }

    private fun parseInt(value: Any?, fallback: Int): Int {
        return when (value) {
            is Number -> value.toInt()
            is String -> value.toIntOrNull() ?: fallback
            else -> fallback
        }
    }

    private fun parseDouble(value: Any?, fallback: Double): Double {
        return parseNullableDouble(value) ?: fallback
    }

    private fun parseNullableDouble(value: Any?): Double? {
        return when (value) {
            is Number -> value.toDouble()
            is String -> value.toDoubleOrNull()
            else -> null
        }
    }

    private fun parseStringList(value: Any?): List<String>? {
        return (value as? List<*>)?.mapNotNull { it as? String }
    }

    private fun showFloatingEmoji() {
        val emojiView = ImageView(this)
        emojiView.setImageResource(R.drawable.ic_heart)
        val rootView = findViewById<ViewGroup>(android.R.id.content)
        rootView.addView(emojiView, ViewGroup.LayoutParams(100, 100))
        emojiView.translationY = rootView.height.toFloat()
        emojiView.animate()
            .translationYBy(-rootView.height.toFloat())
            .alpha(0f)
            .setDuration(1000)
            .withEndAction { rootView.removeView(emojiView) }
            .start()
    }


    private fun loadPostDetails() {
        val token = TokenManager.getToken(this) ?: return
        val id = postId ?: return

        ApiClient.apiService.getPostById(
            token = "Bearer $token",
            postId = id
        ).enqueue(object : Callback<Post> {

            override fun onResponse(call: Call<Post>, response: Response<Post>) {
                if (!response.isSuccessful || response.body() == null) return

                val post = response.body()!!
                currentPost = post

                val displayPost = latestCommentCount?.let { count ->
                    post.copy(commentCount = count)
                } ?: post

                postHeaderAdapter.submitPost(displayPost)
                openDeepLinkedMediaIfNeeded(post)

            }

            override fun onFailure(call: Call<Post>, t: Throwable) {
                Log.e("CommentsActivity", "Failed to load post", t)
            }
        })
    }

    private fun openDeepLinkedMediaIfNeeded(post: Post) {
        if (deepLinkMediaOpened) return
        if (!intent.getBooleanExtra(AppLinkManager.EXTRA_OPEN_MEDIA_FROM_DEEP_LINK, false)) return

        val startAtSeconds = intent.getIntExtra(AppLinkManager.EXTRA_START_AT_SECONDS, 0).coerceAtLeast(0)
        val mediaType = when {
            !post.videoUrl.isNullOrBlank() -> "video"
            !post.audioUrl.isNullOrBlank() -> "audio"
            else -> null
        } ?: return

        val mediaUrl = when (mediaType) {
            "video" -> post.optimizedVideoUrl() ?: post.videoUrl
            "audio" -> post.optimizedAudioUrl() ?: post.audioUrl
            else -> null
        } ?: return

        deepLinkMediaOpened = true
        startActivity(Intent(this, PostMediaActivity::class.java).apply {
            putExtra("POST_ID", post._id)
            putExtra("MEDIA_URL", mediaUrl)
            putExtra("MEDIA_TYPE", mediaType)
            putExtra("USERNAME", post.userId.username)
            putExtra("CAPTION", post.caption ?: "")
            putExtra(AppLinkManager.EXTRA_START_AT_SECONDS, startAtSeconds)
        })
    }


    private fun resetSendButton() {
        buttonSend.setOnClickListener {
            val text = editComment.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, R.string.enter_comment, Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            postComment(text)
        }
    }
}
