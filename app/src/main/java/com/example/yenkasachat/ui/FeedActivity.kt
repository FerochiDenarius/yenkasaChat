package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.FeedResponse
import com.example.yenkasachat.model.LikeResponse
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.TrackLoginResponse
import com.example.yenkasachat.network.ApiClient
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FeedActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var communityNameView: TextView

    private val posts = mutableListOf<Post>()
    private lateinit var adapter: PostAdapter

    private var token: String? = null
    private var userId: String? = null
    private var currentPage = 1
    private var isLoading = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_feed)

        initAuth()
        initViews()
        setupRecyclerView()
        setupSwipeRefresh()

        // ✅ Load feed once adapter is ready
        recyclerView.post {
            Log.d("FeedActivity", "🚀 Adapter attached, loading feed now...")
            loadFeed()
        }

        // ✅ Track daily login
        trackDailyLogin()

        // ✅ Use TokenManager instead of SharedPreferences
        fabCreatePost.setOnClickListener {
            val isVerified = TokenManager.isVerified(this)

            if (isVerified) {
                startActivity(Intent(this, PostActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    "You must verify your account before posting.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun initAuth() {
        token = TokenManager.getToken(this)
        userId = TokenManager.getUserId(this)

        Log.d("FeedActivity", "🔑 Token from TokenManager: $token")
        Log.d("FeedActivity", "👤 UserId from TokenManager: $userId")

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
    }

    override fun onResume() {
        super.onResume()
        Log.d("FeedActivity", "🔁 onResume triggered — refreshing feed")
        refreshFeed()
    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewFeed)
        swipeRefresh = findViewById(R.id.swipeRefreshFeed)
        fabCreatePost = findViewById(R.id.fabCreatePost)
        progressBar = findViewById(R.id.progressBarFeed)
        emptyView = findViewById(R.id.textEmptyFeed)
        communityNameView = findViewById(R.id.textCommunityNameHeader)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        val communityName = prefs.getString("communityName", "Your Community")
        communityNameView.text = communityName

        Log.d("FeedActivity", "🏘️ Community: $communityName")
    }

    private fun setupRecyclerView() {
        adapter = PostAdapter(
            posts = posts,
            onLikeClick = { post, position -> toggleLike(post, position) },
            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { userId -> openUserProfile(userId) },
            onPostClick = { post ->
                val intent = Intent(this, PostDetailActivity::class.java)
                intent.putExtra("POST_ID", post._id)
                startActivity(intent)
            }
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrolled(rv: RecyclerView, dx: Int, dy: Int) {
                super.onScrolled(rv, dx, dy)
                val layoutManager = rv.layoutManager as LinearLayoutManager
                val lastVisible = layoutManager.findLastVisibleItemPosition()
                val totalItems = layoutManager.itemCount
                if (!isLoading && lastVisible >= totalItems - 3) {
                    loadMorePosts()
                }
            }
        })
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener {
            Log.d("FeedActivity", "🔄 User triggered refresh")
            refreshFeed()
        }
    }

    private fun loadFeed() {
        if (isLoading) return
        isLoading = true
        showLoading(true)

        Log.d("FeedActivity", "📡 Fetching feed page $currentPage...")

        ApiClient.apiService.getFeed("Bearer $token", page = currentPage, limit = 20)
            .enqueue(object : Callback<FeedResponse> {
                override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false

                    Log.d("FeedActivity", "✅ Response code: ${response.code()}")

                    if (response.isSuccessful && response.body() != null) {
                        val feedResponse = response.body()!!
                        Log.d("FeedActivity", "📦 Posts received: ${feedResponse.posts.size}")
                        Log.d("FeedActivity", "🧩 Pagination: ${feedResponse.pagination}")

                        if (currentPage == 1) posts.clear()
                        posts.addAll(feedResponse.posts)
                        adapter.updatePosts(posts)

                        emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        val errorBody = response.errorBody()?.string()
                        Log.e("FeedActivity", "❌ Failed to load feed. Error body: $errorBody")
                        Toast.makeText(this@FeedActivity, "Failed to load feed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false
                    Log.e("FeedActivity", "💥 Network failure: ${t.message}", t)
                    Toast.makeText(this@FeedActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadMorePosts() {
        currentPage++
        Log.d("FeedActivity", "⬇️ Loading more posts (page $currentPage)")
        loadFeed()
    }

    private fun refreshFeed() {
        currentPage = 1
        Log.d("FeedActivity", "🔁 Refreshing feed from page 1")
        loadFeed()
    }

    private fun toggleLike(post: Post, position: Int) {
        val call = if (post.likedByCurrentUser)
            ApiClient.apiService.unlikePost("Bearer $token", post._id)
        else
            ApiClient.apiService.likePost("Bearer $token", post._id)

        Log.d("FeedActivity", "❤️ Toggle like for post ${post._id} (current liked=${post.likedByCurrentUser})")

        call.enqueue(object : Callback<LikeResponse> {
            override fun onResponse(call: Call<LikeResponse>, response: Response<LikeResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    val likeResponse = response.body()!!
                    adapter.updateLikeStatus(position, likeResponse.liked, likeResponse.likeCount)
                    Log.d("FeedActivity", "👍 Like updated: liked=${likeResponse.liked}, count=${likeResponse.likeCount}")
                    if (likeResponse.coinsRewarded > 0) {
                        Toast.makeText(
                            this@FeedActivity,
                            "Post author earned ${likeResponse.coinsRewarded} coins 🪙",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                } else {
                    Log.e("FeedActivity", "❌ Failed to update like. Code=${response.code()}")
                }
            }

            override fun onFailure(call: Call<LikeResponse>, t: Throwable) {
                Log.e("FeedActivity", "💥 Like request failed: ${t.message}", t)
                Toast.makeText(this@FeedActivity, "Failed: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun openComments(post: Post) {
        val intent = Intent(this, CommentsActivity::class.java)
        intent.putExtra("POST_ID", post._id)
        startActivity(intent)
    }

    private fun openUserProfile(userId: String) {
        val intent = Intent(this, UserProfileActivity::class.java)
        intent.putExtra("USER_ID", userId)
        startActivity(intent)
    }

    private fun trackDailyLogin() {
        Log.d("FeedActivity", "📆 Tracking daily login...")
        ApiClient.apiService.trackLogin("Bearer $token")
            .enqueue(object : Callback<TrackLoginResponse> {
                override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) {
                    Log.d("FeedActivity", "✅ Login tracking response code: ${response.code()}")
                }

                override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                    Log.e("FeedActivity", "💥 Login tracking failed: ${t.message}", t)
                }
            })
    }

    private fun showLoading(show: Boolean) {
        if (currentPage == 1) {
            progressBar.visibility = if (show) View.VISIBLE else View.GONE
        }
    }
}
