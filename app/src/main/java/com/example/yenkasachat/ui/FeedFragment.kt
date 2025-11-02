package com.example.yenkasachat.ui

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.*
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FeedFragment : Fragment() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var communityNameView: TextView
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var btnSelectCommunities: LinearLayout
    private lateinit var selectedCommunitiesText: TextView

    private val posts = mutableListOf<Post>()
    private lateinit var adapter: PostAdapter

    private var token: String? = null
    private var userId: String? = null
    private var currentPage = 1
    private var isLoading = false

    private var allCommunities: List<String> = emptyList()
    private val selectedCommunities = mutableSetOf<String>()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? = inflater.inflate(R.layout.activity_feed, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        initAuth()
        initViews(view)
        setupRecyclerView()
        setupSwipeRefresh()

        recyclerView.post {
            loadCommunitiesAndFeed()
        }

        trackDailyLogin()

        fabCreatePost.setOnClickListener {
            val isVerified = TokenManager.isVerified(requireContext())
            if (isVerified) {
                startActivity(Intent(requireContext(), PostActivity::class.java))
            } else {
                Toast.makeText(requireContext(), "Verify your account before posting.", Toast.LENGTH_LONG).show()
            }
        }

        btnSelectCommunities.setOnClickListener { showCommunitySelectorDialog() }
    }

    // 🔑 AUTH SETUP
    private fun initAuth() {
        token = TokenManager.getToken(requireContext())
        userId = TokenManager.getUserId(requireContext())

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(requireContext(), "Please log in again.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }
    }

    // 🎨 VIEW INIT
    private fun initViews(view: View) {
        recyclerView = view.findViewById(R.id.recyclerViewFeed)
        swipeRefresh = view.findViewById(R.id.swipeRefreshFeed)
        progressBar = view.findViewById(R.id.progressBarFeed)
        emptyView = view.findViewById(R.id.textEmptyFeed)
        communityNameView = view.findViewById(R.id.textCommunityNameHeader)
        fabCreatePost = requireActivity().findViewById(R.id.fabCreatePost)
        btnSelectCommunities = view.findViewById(R.id.btnSelectCommunities)
        selectedCommunitiesText = view.findViewById(R.id.textSelectedCommunities)
    }

    // 📰 RECYCLERVIEW
    private fun setupRecyclerView() {
        adapter = PostAdapter(
            posts = posts,
            onLikeClick = { post, position -> toggleLike(post, position) },
            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { userId -> openUserProfile(userId) },
            onPostClick = { post ->
                val intent = Intent(requireContext(), PostDetailActivity::class.java)
                intent.putExtra("POST_ID", post._id)
                startActivity(intent)
            },
            onShareClick = { post ->
                // Optional: implement sharing or leave empty if not needed
                val shareIntent = Intent(Intent.ACTION_SEND)
                shareIntent.type = "text/plain"
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
                shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
                startActivity(Intent.createChooser(shareIntent, "Share via"))
            }
        )
        recyclerView.layoutManager = LinearLayoutManager(requireContext())
        recyclerView.adapter = adapter
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener {
            refreshFeed()
        }
    }

    // 🌍 LOAD COMMUNITIES
    private fun loadCommunitiesAndFeed() {
        Log.d("FeedFragment", "🌍 Loading available communities...")

        ApiClient.apiService.getMyCommunities("Bearer $token")
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val communities = response.body()!!

                        // ✅ Extract display names (fallback to name)
                        allCommunities = communities.map { it.displayName.ifEmpty { it.name } }

                        // ✅ Default selection
                        selectedCommunities.clear()
                        if (allCommunities.isNotEmpty()) {
                            selectedCommunities.add(allCommunities.first())
                        } else {
                            selectedCommunities.add("All")
                        }

                        updateSelectedCommunitiesUI()
                        loadFeed()
                        Log.d("FeedFragment", "✅ Loaded ${communities.size} communities successfully")
                    } else {
                        Log.w("FeedFragment", "⚠️ Could not fetch communities — code ${response.code()}")
                        allCommunities = listOf("All")
                        selectedCommunities.clear()
                        selectedCommunities.add("All")
                        updateSelectedCommunitiesUI()
                        loadFeed()
                    }
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    Log.e("FeedFragment", "💥 Failed to load communities: ${t.message}", t)
                    allCommunities = listOf("All")
                    selectedCommunities.clear()
                    selectedCommunities.add("All")
                    updateSelectedCommunitiesUI()
                    loadFeed()
                }
            })
    }

    private fun showCommunitySelectorDialog() {
        if (allCommunities.isEmpty()) return

        val checkedItems = BooleanArray(allCommunities.size) { i ->
            selectedCommunities.contains(allCommunities[i])
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Select Communities")
            .setMultiChoiceItems(allCommunities.toTypedArray(), checkedItems) { _, which, isChecked ->
                val community = allCommunities[which]
                if (isChecked) selectedCommunities.add(community)
                else selectedCommunities.remove(community)
            }
            .setPositiveButton("Apply") { dialog, _ ->
                updateSelectedCommunitiesUI()
                refreshFeed()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateSelectedCommunitiesUI() {
        val displayText = if (selectedCommunities.isEmpty()) "No community selected"
        else selectedCommunities.joinToString(", ")
        selectedCommunitiesText.text = displayText
        communityNameView.text = if (selectedCommunities.size == 1) selectedCommunities.first() else "Multiple Communities"
    }

    // 📡 FEED LOADING
    private fun loadFeed() {
        if (isLoading) return
        isLoading = true
        showLoading(true)

        val selected = selectedCommunities.joinToString(", ")
        Log.d("FeedFragment", "📡 Loading feed for: $selected")

        ApiClient.apiService.getFeed("Bearer $token", page = currentPage, limit = 20)
            .enqueue(object : Callback<FeedResponse> {
                override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false

                    if (response.isSuccessful && response.body() != null) {
                        val feedResponse = response.body()!!
                        posts.clear()
                        posts.addAll(feedResponse.posts)
                        adapter.updatePosts(posts)
                        emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        Toast.makeText(requireContext(), "Failed to load feed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                    isLoading = false
                    showLoading(false)
                    swipeRefresh.isRefreshing = false
                    Log.e("FeedFragment", "💥 Network failure: ${t.message}", t)
                }
            })
    }

    private fun refreshFeed() {
        currentPage = 1
        posts.clear()
        adapter.notifyDataSetChanged()
        loadFeed()
    }

    private fun toggleLike(post: Post, position: Int) {
        val call = if (post.likedByCurrentUser)
            ApiClient.apiService.unlikePost("Bearer $token", post._id)
        else
            ApiClient.apiService.likePost("Bearer $token", post._id)

        call.enqueue(object : Callback<LikeResponse> {
            override fun onResponse(call: Call<LikeResponse>, response: Response<LikeResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    val likeResponse = response.body()!!
                    adapter.updateLikeStatus(position, likeResponse.liked, likeResponse.likeCount)
                }
            }

            override fun onFailure(call: Call<LikeResponse>, t: Throwable) {
                Log.e("FeedFragment", "💥 Like request failed: ${t.message}", t)
            }
        })
    }

    private fun openComments(post: Post) {
        val intent = Intent(requireContext(), CommentsActivity::class.java)
        intent.putExtra("POST_ID", post._id)
        startActivity(intent)
    }

    private fun openUserProfile(userId: String) {
        val intent = Intent(requireContext(), UserProfileActivity::class.java)
        intent.putExtra("USER_ID", userId)
        startActivity(intent)
    }

    private fun trackDailyLogin() {
        ApiClient.apiService.trackLogin("Bearer $token").enqueue(object : Callback<TrackLoginResponse> {
            override fun onResponse(call: Call<TrackLoginResponse>, response: Response<TrackLoginResponse>) {}
            override fun onFailure(call: Call<TrackLoginResponse>, t: Throwable) {
                Log.e("FeedFragment", "Login track failed: ${t.message}", t)
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show && currentPage == 1) View.VISIBLE else View.GONE
    }
}
