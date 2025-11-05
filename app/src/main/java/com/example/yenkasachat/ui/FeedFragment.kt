package com.example.yenkasachat.ui

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.*
import android.widget.*
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.SocketManager
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.ui.FeedUtils
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FeedFragment : Fragment() {

    private lateinit var recyclerView: RecyclerView
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

    private var allCommunities: List<Community> = emptyList()
    private val selectedCommunities = mutableSetOf<Community>()


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

        recyclerView.post { fetchCommunitiesAndFeed() }

        trackDailyLogin()

        fabCreatePost.setOnClickListener {
            val isVerified = TokenManager.isVerified(requireContext())
            if (isVerified)
                startActivity(Intent(requireContext(), PostActivity::class.java))
            else
                Toast.makeText(requireContext(), "Verify your account before posting.", Toast.LENGTH_LONG).show()
        }

        btnSelectCommunities.setOnClickListener { showCommunitySelectorDialog() }

        // 🧠 Initialize socket listener
        setupSocketListeners()
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
            onLikeClick = { post, position ->
                val context = requireContext()
                val token = TokenManager.getToken(context)

                if (!token.isNullOrEmpty()) {
                    FeedUtils.toggleLike(context, token, post) { liked, newLikeCount ->
                        // ✅ Update post with new like state + count
                        val updatedPost = post.copy(
                            likedByCurrentUser = liked,  // must match Post model field
                            likeCount = newLikeCount
                        )

                        posts[position] = updatedPost
                        adapter.notifyItemChanged(position)
                    }
                } else {
                    Toast.makeText(context, "Please log in again", Toast.LENGTH_SHORT).show()
                }
            },

            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { id -> openUserProfile(id) },
            onPostClick = { post ->
                val intent = Intent(requireContext(), PostMediaActivity::class.java)
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

        recyclerView.layoutManager = LinearLayoutManager(requireContext())
        recyclerView.adapter = adapter
    }

    // 🌍 FETCH COMMUNITIES
    private fun fetchCommunitiesAndFeed() {
        ApiClient.apiService.getCommunities("Bearer $token")
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        allCommunities = response.body()!!

                        selectedCommunities.clear()
                        if (allCommunities.isNotEmpty()) {
                            selectedCommunities.add(allCommunities.first())
                        }

                        updateSelectedCommunitiesUI()
                        loadFeed()

                        Log.d("FeedFragment", "✅ Loaded ${allCommunities.size} communities from backend")
                    } else {
                        Log.w("FeedFragment", "⚠️ Failed to load communities, empty or error response")
                        fallbackCommunity()
                    }
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    Log.e("FeedFragment", "❌ Error fetching communities: ${t.message}", t)
                    fallbackCommunity()
                }
            })
    }

    private fun fallbackCommunity() {
        allCommunities = emptyList()
        selectedCommunities.clear()
        updateSelectedCommunitiesUI()
        loadFeed()
    }

    // 🧩 COMMUNITY SELECTOR DIALOG
    private fun showCommunitySelectorDialog() {
        if (allCommunities.isEmpty()) {
            Toast.makeText(requireContext(), "No communities found.", Toast.LENGTH_SHORT).show()
            return
        }

        val names = allCommunities.map { it.displayName }
        val checkedItems = BooleanArray(allCommunities.size) { i ->
            selectedCommunities.contains(allCommunities[i])
        }

        AlertDialog.Builder(requireContext())
            .setTitle("Select Communities")
            .setMultiChoiceItems(names.toTypedArray(), checkedItems) { _, which, isChecked ->
                val community = allCommunities[which]
                if (isChecked) selectedCommunities.add(community)
                else selectedCommunities.remove(community)
            }
            .setPositiveButton("Apply") { dialog, _ ->
                updateSelectedCommunitiesUI()
                loadFeed()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun updateSelectedCommunitiesUI() {
        val text = if (selectedCommunities.isEmpty())
            "No community selected"
        else selectedCommunities.joinToString(", ") { it.displayName ?: it.name ?: "Unknown" }

        selectedCommunitiesText.text = text

        communityNameView.text = when {
            selectedCommunities.isEmpty() -> "No Community"
            selectedCommunities.size == 1 -> selectedCommunities.first().displayName
                ?: selectedCommunities.first().name
                ?: "Unnamed"
            else -> "Multiple Communities"
        }
    }

    // 📡 LOAD FEED
    private fun loadFeed(page: Int = 1) {
        if (isLoading) return
        isLoading = true
        showLoading(true)

        ApiClient.apiService.getFeed("Bearer $token", page, 20)
            .enqueue(object : Callback<FeedResponse> {
                override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                    isLoading = false
                    showLoading(false)

                    if (response.isSuccessful && response.body() != null) {
                        val feedResponse = response.body()!!
                        posts.clear()
                        posts.addAll(feedResponse.posts)
                        adapter.updatePosts(posts)
                        emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE

                        Log.d("FeedFragment", "✅ Loaded ${feedResponse.posts.size} posts, page ${feedResponse.pagination.currentPage}")
                    } else {
                        Toast.makeText(requireContext(), "Failed to load feed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                    isLoading = false
                    showLoading(false)
                    Log.e("FeedFragment", "Network failure: ${t.message}", t)
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

    // ⚡️ SOCKET.IO INTEGRATION
    private fun setupSocketListeners() {
        // Use your global SocketManager
        SocketManager.on("newPost") { data ->
            try {
                val json = data as JSONObject
                val newPost = Post.fromJson(json)
                lifecycleScope.launch {
                    posts.add(0, newPost)
                    adapter.updatePosts(posts)
                    recyclerView.scrollToPosition(0)
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing newPost", e)
            }
        }

        SocketManager.on("likeUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val likeCount = json.getInt("likeCount")

                lifecycleScope.launch {
                    val index = posts.indexOfFirst { it._id == postId }
                    if (index >= 0) {
                        val updated = posts[index].copy(likeCount = likeCount)
                        posts[index] = updated
                        adapter.notifyItemChanged(index)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing likeUpdate", e)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
    }
}
