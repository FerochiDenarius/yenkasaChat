package com.example.yenkasachat.ui

import android.net.Uri
import android.os.Bundle
import android.util.Log
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

        // 🔹 Initialize views
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

        adapter = CommentAdapter(this, comments)
        val layoutManager = LinearLayoutManager(this)
        layoutManager.stackFromEnd = true // show newest comments at bottom
        recyclerComments.layoutManager = layoutManager
        recyclerComments.adapter = adapter

        postId = intent.getStringExtra("POST_ID")
        if (postId.isNullOrEmpty()) {
            Toast.makeText(this, "Post not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

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

    // ✅ Auto-refresh
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
                delay(15000) // every 15 seconds
            }
        }
    }

    private fun stopAutoRefresh() {
        autoRefreshJob?.cancel()
        autoRefreshJob = null
    }

    // ✅ Load post info (caption, media, likes, etc.)
    private fun loadPostDetails() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) return

        ApiClient.apiService.getPostById("Bearer $token", postId!!)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    if (response.isSuccessful && response.body() != null) {
                        val post = response.body()!!
                        textCaption.text = post.caption ?: ""
                        textLikes.text = "${post.likes?.size ?: 0} likes"
                        textComments.text = " • ${(post.comments?.size ?: 0)} comments"
                        textViews.text = " • ${post.views} views"

                        if (!post.mediaUrl.isNullOrEmpty()) {
                            if (post.mediaUrl!!.endsWith(".mp4")) {
                                videoPost.setVideoURI(Uri.parse(post.mediaUrl))
                                videoPost.visibility = android.view.View.VISIBLE
                                imagePost.visibility = android.view.View.GONE
                                videoPost.setOnPreparedListener { it.start() }
                            } else {
                                Glide.with(this@CommentsActivity)
                                    .load(post.mediaUrl)
                                    .into(imagePost)
                                imagePost.visibility = android.view.View.VISIBLE
                                videoPost.visibility = android.view.View.GONE
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

        ApiClient.apiService.addComment("Bearer $token", postId!!, mapOf("text" to text))
            .enqueue(object : Callback<Comment> {
                override fun onResponse(call: Call<Comment>, response: Response<Comment>) {
                    if (response.isSuccessful) {
                        response.body()?.let { newComment ->
                            comments.add(newComment)
                            adapter.notifyItemInserted(comments.size - 1)
                            recyclerComments.scrollToPosition(comments.size - 1)
                            editComment.text.clear()

                            loadComments() // force refresh for consistency
                            sendCommentNotification(newComment)
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
                conn.setRequestProperty("Authorization", "Basic YOUR_REST_API_KEY") // replace this
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }

                val responseCode = conn.responseCode
                Log.d("CommentsActivity", "OneSignal response: $responseCode")
            } catch (e: Exception) {
                Log.e("CommentsActivity", "Failed to send comment notification: ${e.message}")
            }
        }
    }
}
