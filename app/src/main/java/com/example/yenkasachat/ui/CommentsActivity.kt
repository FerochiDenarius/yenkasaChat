package com.example.yenkasachat.ui

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.*
import com.google.gson.Gson
import com.example.yenkasachat.model.CommentsResponse
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.CommentAdapter
import com.example.yenkasachat.model.Comment
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.*
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.net.HttpURLConnection
import java.net.URL
import android.media.MediaPlayer
import android.view.animation.BounceInterpolator
import android.view.animation.ScaleAnimation
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody







class CommentsActivity : AppCompatActivity() {

    private lateinit var recyclerComments: RecyclerView
    private lateinit var editComment: EditText
    private lateinit var buttonSend: ImageButton
    private lateinit var adapter: CommentAdapter
    private val comments = mutableListOf<Comment>()

    private lateinit var textCaption: TextView
    private lateinit var imagePost: ImageView
    private lateinit var videoPost: VideoView
    private lateinit var textLikes: TextView
    private lateinit var textComments: TextView
    private lateinit var textViews: TextView

    private var postId: String? = null
    private var isRefreshing = false
    private var autoRefreshJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_comments)

        // Initialize views
        recyclerComments = findViewById(R.id.recyclerComments)
        editComment = findViewById(R.id.editComment)
        buttonSend = findViewById(R.id.buttonSend)
        textCaption = findViewById(R.id.textPostCaption)
        imagePost = findViewById(R.id.imagePostMedia)
        videoPost = findViewById(R.id.videoPostMedia)
        textLikes = findViewById(R.id.textPostLikes)
        textComments = findViewById(R.id.textPostComments)
        textViews = findViewById(R.id.textPostViews)

        val buttonBack = findViewById<ImageButton>(R.id.buttonBack)
        buttonBack.setOnClickListener { onBackPressedDispatcher.onBackPressed() }

        // ✅ Initialize adapter with CommentActionListener
        adapter = CommentAdapter(this, comments, object : CommentAdapter.CommentActionListener {

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

                                        editComment.text.clear()
                                        Toast.makeText(this@CommentsActivity, "Reply posted", Toast.LENGTH_SHORT).show()
                                        loadComments()
                                        resetSendButton()

                                        Log.d("CommentsActivity", "✅ Added reply: ${newComment.text}")
                                    } else {
                                        Toast.makeText(this@CommentsActivity, map["message"].toString(), Toast.LENGTH_SHORT).show()
                                    }
                                } else {
                                    Toast.makeText(this@CommentsActivity, "Failed to post reply", Toast.LENGTH_SHORT).show()
                                }
                            }

                            override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                                Toast.makeText(this@CommentsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
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
                                                Toast.makeText(this@CommentsActivity, "Comment added!", Toast.LENGTH_SHORT).show()
                                                loadComments()
                                                editComment.text.clear()
                                            }
                                        } else {
                                            // ✅ Success HTTP but unexpected JSON
                                            Log.w("PostComment", "Unexpected response structure: $data")
                                            Toast.makeText(this@CommentsActivity, "Comment added (response unparsed)", Toast.LENGTH_SHORT).show()
                                            loadComments()
                                        }
                                    } else {
                                        Toast.makeText(this@CommentsActivity, "Failed to post comment (${response.code()})", Toast.LENGTH_SHORT).show()
                                    }


                                } else {
                                    val code = response.code()
                                    val error = response.errorBody()?.string()
                                    Log.e("EditComment", "Failed → $code | $error")
                                    Toast.makeText(
                                        this@CommentsActivity,
                                        "Failed to update comment ($code)",
                                        Toast.LENGTH_SHORT
                                    ).show()
                                }
                            }

                            override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                                Log.e("EditComment", "Error → ${t.message}", t)
                                Toast.makeText(this@CommentsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
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
                                    Toast.makeText(this@CommentsActivity, "Comment deleted", Toast.LENGTH_SHORT).show()
                                    loadComments()
                                } else {
                                    Toast.makeText(this@CommentsActivity, map["message"].toString(), Toast.LENGTH_SHORT).show()
                                }
                            } else {
                                Toast.makeText(this@CommentsActivity, "Failed to delete comment", Toast.LENGTH_SHORT).show()
                            }
                        }

                        override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                            Toast.makeText(this@CommentsActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                        }
                    })
            }
        })


        val layoutManager = LinearLayoutManager(this)
        layoutManager.stackFromEnd = true
        recyclerComments.layoutManager = layoutManager
        recyclerComments.adapter = adapter

        postId = intent.getStringExtra("POST_ID")
        if (postId.isNullOrEmpty()) {
            Toast.makeText(this, "Post not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Load post and comments
        loadPostDetails()
        loadComments()

        buttonSend.setOnClickListener {
            val text = editComment.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Enter a comment", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            postComment(text)
        }
    }

    override fun onResume() {
        super.onResume()
        startAutoRefresh()
    }

    override fun onPause() {
        super.onPause()
        stopAutoRefresh()
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

    private fun loadPostDetails() {
        val token = TokenManager.getToken(this) ?: return

        ApiClient.apiService.getPostById("Bearer $token", postId!!)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    if (response.isSuccessful && response.body() != null) {
                        val post = response.body()!!

                        // Set caption
                        textCaption.text = post.caption

                        // Set likes, comments, views
                        textLikes.text = "${post.likes.size} likes"
                        textComments.text = " • ${post.commentCount} comments"
                        textViews.text = " • ${post.viewCount} views"

                        // ✅ FIX: Updated logic to use 'mediaUrl' instead of 'videoUrl'
                        val mediaUrl = post.mediaUrl
                        val imageUrl = post.imageUrl
                        val mediaUrls = post.mediaUrls

                        // Hide both views initially
                        imagePost.visibility = View.GONE
                        videoPost.visibility = View.GONE

                        when {
                            // Case 1: A single video is available in 'mediaUrl'
                            !mediaUrl.isNullOrEmpty() && mediaUrl.endsWith(".mp4") -> {
                                videoPost.setVideoURI(Uri.parse(mediaUrl))
                                videoPost.visibility = View.VISIBLE
                                videoPost.setOnPreparedListener { mp ->
                                    mp.isLooping = true // Good for short videos
                                    mp.start()
                                }
                            }
                            // Case 2: A single image is available in 'imageUrl' or 'mediaUrl'
                            !imageUrl.isNullOrEmpty() || !mediaUrl.isNullOrEmpty() -> {
                                val urlToShow = imageUrl ?: mediaUrl // Prioritize imageUrl if both exist
                                Glide.with(this@CommentsActivity)
                                    .load(urlToShow)
                                    .into(imagePost)
                                imagePost.visibility = View.VISIBLE
                            }
                            // Case 3: Multiple media items are available
                            !mediaUrls.isNullOrEmpty() -> {
                                val first = mediaUrls[0]
                                if (first.endsWith(".mp4")) {
                                    videoPost.setVideoURI(Uri.parse(first))
                                    videoPost.visibility = View.VISIBLE
                                    videoPost.setOnPreparedListener { mp ->
                                        mp.isLooping = true
                                        mp.start()
                                    }
                                } else {
                                    Glide.with(this@CommentsActivity)
                                        .load(first)
                                        .into(imagePost)
                                    imagePost.visibility = View.VISIBLE
                                }
                            }
                        }
                    }
                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    Log.e("CommentsActivity", "Failed to load post: ${t.message}")
                }
            })
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
                    recyclerComments.scrollToPosition(comments.size - 1)
                } else {
                    Log.e("CommentsActivity", "Failed to load comments: ${response.code()} | ${response.errorBody()?.string()}")
                    if (!autoRefresh) {
                        Toast.makeText(
                            this@CommentsActivity,
                            "Failed to load comments (${response.code()})",
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
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        })
    }

    private fun postComment(text: String) {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
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

                            runOnUiThread {
                                Toast.makeText(
                                    this@CommentsActivity,
                                    "Comment added!",
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
                                    "Failed to parse comment response",
                                    Toast.LENGTH_SHORT
                                ).show()
                            }
                        }
                    } else {
                        runOnUiThread {
                            Toast.makeText(
                                this@CommentsActivity,
                                "Failed to post comment",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    runOnUiThread {
                        Toast.makeText(
                            this@CommentsActivity,
                            "Error: ${t.message}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }
            })
    }
    private fun sendCommentNotification(comment: Comment) {
        val jsonBody = JSONObject().apply {
            put("app_id", "165df9e6-a0ea-4a37-a40a-110af7e28ad2")
            put("included_segments", JSONArray().put("Subscribed Users"))
            put("headings", JSONObject().put("en", "New Comment on Your Post"))
            put("contents", JSONObject().put("en", "${comment.user?.username ?: "Someone"}: ${comment.text}"))
            put("data", JSONObject().put("post_id", postId))
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("https://onesignal.com/api/v1/notifications")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                conn.setRequestProperty("Authorization", "Basic YOUR_REST_API_KEY")
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                Log.d("CommentsActivity", "OneSignal response: ${conn.responseCode}")
            } catch (e: Exception) {
                Log.e("CommentsActivity", "Failed to send comment notification: ${e.message}")
            }
        }
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




    private fun resetSendButton() {
        buttonSend.setOnClickListener {
            val text = editComment.text.toString().trim()
            if (text.isEmpty()) {
                Toast.makeText(this, "Enter a comment", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            postComment(text)
        }
    }
}
