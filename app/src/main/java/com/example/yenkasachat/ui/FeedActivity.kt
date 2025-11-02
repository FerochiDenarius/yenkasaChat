package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FeedActivity : AppCompatActivity() {

    // 🔹 UI Components
    private lateinit var recyclerView: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var btnSelectCommunities: Button
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var communityHeader: TextView

    // 🔹 Data
    private val posts = mutableListOf<Post>()
    private lateinit var adapter: PostAdapter
    private var selectedCommunities = mutableListOf<String>()
    private var token: String? = null
    private var userId: String? = null
    private var currentPage = 1
    private var isLoading = false

    // ----------------------------------------------------------------------
    // 🔹 Lifecycle
    // ----------------------------------------------------------------------
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_feed)

        Log.d("FeedActivity", "🎬 onCreate started")

        initAuth()
        initViews()
        setupRecyclerView()
        setupSwipeRefresh()
        setupCommunitySelector()

        recyclerView.post {
            Log.d("FeedActivity", "🚀 Loading feed after view initialized")
            loadFeed()
        }

        setupListeners()
    }

    // ----------------------------------------------------------------------
    // 🔹 Initialization
    // ----------------------------------------------------------------------
    private fun initAuth() {
        token = TokenManager.getToken(this)
        userId = TokenManager.getUserId(this)

        Log.d("FeedActivity", "🔑 Token: ${token ?: "null"}")
        Log.d("FeedActivity", "👤 UserId: ${userId ?: "null"}")

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewFeed)
        swipeRefresh = findViewById(R.id.swipeRefreshFeed)
        progressBar = findViewById(R.id.progressBarFeed)
        emptyView = findViewById(R.id.textEmptyFeed)
        btnSelectCommunities = findViewById(R.id.btnSelectCommunities)
        fabCreatePost = findViewById(R.id.fabCreatePost)
        communityHeader = findViewById(R.id.textCommunityHeader)
    }

    // ----------------------------------------------------------------------
    // 🔹 RecyclerView & Swipe
    // ----------------------------------------------------------------------
    private fun setupRecyclerView() {
        adapter = PostAdapter(
            posts = posts,
            onLikeClick = { post, _ ->  // discard position
                FeedUtils.toggleLike(this, token!!, post) { liked, likeCount ->
                    val position = posts.indexOf(post)
                    if (position != -1) {
                        adapter.updateLikeStatus(position, liked, likeCount)
                    }
                }
            },
            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { userId -> openUserProfile(userId) },
            onPostClick = { post ->
                FeedUtils.addView(this, token!!, post._id)
                val intent = Intent(this, PostDetailActivity::class.java)
                intent.putExtra("POST_ID", post._id)
                startActivity(intent)
            },
            onShareClick = { post ->
                val shareIntent = Intent(Intent.ACTION_SEND)
                shareIntent.type = "text/plain"
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
                shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
                startActivity(Intent.createChooser(shareIntent, "Share via"))
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
            Log.d("FeedActivity", "🔄 Swipe refresh triggered")
            refreshFeed()
        }
    }

    // ----------------------------------------------------------------------
    // 🔹 Button & Listeners
    // ----------------------------------------------------------------------
    private fun setupListeners() {
        fabCreatePost.setOnClickListener {
            val isVerified = TokenManager.isVerified(this)
            if (isVerified) {
                startActivity(Intent(this, PostActivity::class.java))
            } else {
                Toast.makeText(this, "You must verify your account before posting.", Toast.LENGTH_LONG).show()
            }
        }
    }

    // ----------------------------------------------------------------------
    // 🔹 Community Selector
    // ----------------------------------------------------------------------
    private fun setupCommunitySelector() {
        btnSelectCommunities.setOnClickListener {
            lifecycleScope.launch {
                try {
                    val response = ApiClient.apiService.getCommunities()
                    if (response.isSuccessful && response.body() != null) {
                        val allCommunities = response.body()!!
                        val communityNames = allCommunities.map { it.name }.toTypedArray()
                        val selected = BooleanArray(communityNames.size)
                        val selectedIds = mutableListOf<String>()
                        val selectedNames = mutableListOf<String>()

                        val builder = AlertDialog.Builder(this@FeedActivity)
                            .setTitle("Select Communities (max 3)")
                            .setMultiChoiceItems(communityNames, selected) { dialog, which, isChecked ->
                                val communityId = allCommunities[which].id
                                if (isChecked) {
                                    if (selectedIds.size >= 3) {
                                        Toast.makeText(
                                            this@FeedActivity,
                                            "You can only join 3 communities",
                                            Toast.LENGTH_SHORT
                                        ).show()
                                        (dialog as AlertDialog).listView.setItemChecked(which, false)
                                    } else {
                                        selectedIds.add(communityId)
                                        selectedNames.add(communityNames[which])
                                    }
                                } else {
                                    selectedIds.remove(communityId)
                                    selectedNames.remove(communityNames[which])
                                }
                            }
                            .setPositiveButton("Apply") { dialog, _ ->
                                applyCommunitySelection(selectedIds, selectedNames)
                                dialog.dismiss()
                            }
                            .setNegativeButton("Cancel", null)

                        builder.show()
                    } else {
                        Toast.makeText(this@FeedActivity, "Failed to load communities", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(this@FeedActivity, "Error fetching communities", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun applyCommunitySelection(selectedIds: List<String>, selectedNames: List<String>) {
        communityHeader.text = if (selectedNames.isEmpty()) "All Communities" else selectedNames.joinToString(", ")
        Log.d("FeedActivity", "🌍 Selected Communities: $selectedNames")

        val userId = TokenManager.getUserId(this)
        if (userId != null) {
            lifecycleScope.launch {
                try {
                    val joinResponse = ApiClient.apiService.joinCommunities(
                        JoinCommunityRequest(userId, selectedIds)
                    )
                    if (joinResponse.isSuccessful) {
                        Toast.makeText(this@FeedActivity, "Communities updated!", Toast.LENGTH_SHORT).show()
                        refreshFeed()
                    } else {
                        Toast.makeText(this@FeedActivity, "Failed to update communities", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(this@FeedActivity, "Error updating communities", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // ----------------------------------------------------------------------
    // 🔹 Feed Operations
    // ----------------------------------------------------------------------
    private fun loadFeed() {
        if (isLoading) return
        isLoading = true
        showLoading(true)

        Log.d("FeedActivity", "📡 Fetching feed page=$currentPage")

        ApiClient.apiService.getFeed("Bearer $token", page = currentPage, limit = 20)
            .enqueue(object : Callback<FeedResponse> {
                override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false

                    if (response.isSuccessful && response.body() != null) {
                        val feedResponse = response.body()!!
                        if (currentPage == 1) posts.clear()
                        posts.addAll(feedResponse.posts)
                        adapter.updatePosts(posts)
                        emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        Log.e("FeedActivity", "❌ Feed load failed: ${response.code()} ${response.errorBody()?.string()}")
                        Toast.makeText(this@FeedActivity, "Failed to load feed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false
                    Log.e("FeedActivity", "💥 Feed network error: ${t.message}", t)
                    Toast.makeText(this@FeedActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadMorePosts() {
        currentPage++
        loadFeed()
    }

    private fun refreshFeed() {
        currentPage = 1
        loadFeed()
    }

    // ----------------------------------------------------------------------
    // 🔹 Navigation
    // ----------------------------------------------------------------------
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

    // ----------------------------------------------------------------------
    // 🔹 Helpers
    // ----------------------------------------------------------------------
    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }
}
