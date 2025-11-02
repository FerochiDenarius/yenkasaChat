package com.example.yenkasachat.ui

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.*
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
            override fun onReply(comment: Comment) {
                // TODO: Open reply input field or pre-fill editComment with @username
                editComment.setText("@${comment.user?.username ?: ""} ")
                editComment.requestFocus()
                // Optionally, scroll to bottom
                recyclerComments.scrollToPosition(comments.size - 1)
            }

            override fun onEdit(comment: Comment) {
                // TODO: Open edit input with existing comment text
                editComment.setText(comment.text ?: "")
                editComment.requestFocus()
                // Remove old comment temporarily or mark it as editing
                recyclerComments.scrollToPosition(comments.indexOf(comment))
            }

            override fun onDelete(comment: Comment) {
                // TODO: Call backend to delete, then remove from adapter
                adapter.deleteComment(comment)
                Toast.makeText(this@CommentsActivity, "Comment deleted", Toast.LENGTH_SHORT).show()
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
        if (token.isNullOrEmpty()) {
            isRefreshing = false
            return
        }

        ApiClient.apiService.getComments("Bearer $token", postId!!)
            .enqueue(object : Callback<List<Comment>> {
                override fun onResponse(call: Call<List<Comment>>, response: Response<List<Comment>>) {
                    isRefreshing = false
                    if (response.isSuccessful) {
                        val newComments = response.body() ?: emptyList()
                        if (newComments.size != comments.size ||
                            newComments.lastOrNull()?._id != comments.lastOrNull()?._id
                        ) {
                            comments.clear()
                            comments.addAll(newComments)
                            adapter.notifyDataSetChanged()
                            recyclerComments.scrollToPosition(comments.size - 1)
                        }
                    }
                }

                override fun onFailure(call: Call<List<Comment>>, t: Throwable) {
                    isRefreshing = false
                    if (!autoRefresh) {
                        Toast.makeText(this@CommentsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
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

// 1️⃣ Create a JSON object with the comment text
        val json = JSONObject().apply { put("text", text) }.toString()

// 2️⃣ Convert JSON string to RequestBody
        val body: RequestBody = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

// 3️⃣ Call the API with the RequestBody
        ApiClient.apiService.addComment("Bearer $token", postId!!, body)
            .enqueue(object : Callback<Comment> {
                override fun onResponse(call: Call<Comment>, response: Response<Comment>) {
                    if (response.isSuccessful) {
                        response.body()?.let { newComment ->
                            comments.add(newComment)
                            adapter.notifyItemInserted(comments.size - 1)
                            recyclerComments.scrollToPosition(comments.size - 1)
                            editComment.text.clear()
                            loadComments()
                            sendCommentNotification(newComment)
                            animateCommentSuccess()
                            showFloatingEmoji()
                        }
                    } else {
                        Toast.makeText(this@CommentsActivity, "Failed to post comment", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Comment>, t: Throwable) {
                    Toast.makeText(this@CommentsActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
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
}
