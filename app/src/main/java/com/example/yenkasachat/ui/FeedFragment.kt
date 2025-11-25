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
    private lateinit var layoutManager: LinearLayoutManager

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
    ): View? = inflater.inflate(R.layout.feed_fragment, container, false)

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

        setupSocketListeners()
    }

    private fun initAuth() {
        token = TokenManager.getToken(requireContext())
        userId = TokenManager.getUserId(requireContext())

        if (token.isNullOrEmpty() || userId.isNullOrEmpty()) {
            Toast.makeText(requireContext(), "Please log in again.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }
    }

    private fun initViews(view: View) {
        recyclerView = view.findViewById(R.id.recyclerViewFeed)
        progressBar = view.findViewById(R.id.progressBarFeed)
        emptyView = view.findViewById(R.id.textEmptyFeed)
        communityNameView = view.findViewById(R.id.textCommunityNameHeader)
        fabCreatePost = requireActivity().findViewById(R.id.fabCreatePost)
        btnSelectCommunities = view.findViewById(R.id.btnSelectCommunities)
        selectedCommunitiesText = view.findViewById(R.id.textSelectedCommunities)
    }

    private fun setupRecyclerView() {
        layoutManager = LinearLayoutManager(requireContext())

        adapter = PostAdapter(
            requireContext(),
            posts,
            onLikeClick = { post, position ->
                val context = requireContext()
                val token = TokenManager.getToken(context)

                if (!token.isNullOrEmpty()) {
                    FeedUtils.toggleLike(context, token, post) { liked, newLikeCount ->
                        val updatedPost = post.copy(
                            likedByCurrentUser = liked,
                            likeCount = newLikeCount
                        )
                        posts[position] = updatedPost
                        adapter.notifyItemChanged(position)
                    }
                }
            },
            onCommentClick = { post, _ -> openComments(post) },
            onUserClick = { id -> openUserProfile(id) },
            onPostClick = { post ->
                when {
                    !post.imageUrl.isNullOrEmpty() -> openImage(post)
                    !post.videoUrl.isNullOrEmpty() -> openVideo(post)
                    !post.audioUrl.isNullOrEmpty() -> openAudio(post)
                }
            },
            onShareClick = { post -> sharePost(post) }
        )

        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = adapter

        recyclerView.addOnScrollListener(object : RecyclerView.OnScrollListener() {
            override fun onScrollStateChanged(recyclerView: RecyclerView, newState: Int) {
                if (newState == RecyclerView.SCROLL_STATE_IDLE) {
                    playVisibleVideo()
                }
            }

            override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                if (Math.abs(dy) > 20) adapter.pauseAllVideos()
            }
        })
    }

    private fun openImage(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.imageUrl)
        intent.putExtra("MEDIA_TYPE", "image")
        startActivity(intent)
    }

    private fun openVideo(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.videoUrl)
        intent.putExtra("MEDIA_TYPE", "video")
        startActivity(intent)
    }

    private fun openAudio(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.audioUrl)
        intent.putExtra("MEDIA_TYPE", "audio")
        startActivity(intent)
    }

    private fun sharePost(post: Post) {
        val shareIntent = Intent(Intent.ACTION_SEND)
        shareIntent.type = "text/plain"
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
        shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
        startActivity(Intent.createChooser(shareIntent, "Share via"))
    }

    private fun playVisibleVideo() {
        val first = layoutManager.findFirstVisibleItemPosition()
        val last = layoutManager.findLastVisibleItemPosition()
        if (first == RecyclerView.NO_POSITION) return

        var mostVisible = -1
        var maxVisibleHeight = 0

        for (i in first..last) {
            val view = layoutManager.findViewByPosition(i) ?: continue
            val post = posts.getOrNull(i) ?: continue

            val location = IntArray(2)
            view.getLocationOnScreen(location)

            val viewTop = location[1]
            val viewBottom = viewTop + view.height

            val screenHeight = recyclerView.height
            val visibleTop = maxOf(viewTop, 0)
            val visibleBottom = minOf(viewBottom, screenHeight)
            val visibleHeight = visibleBottom - visibleTop

            if (visibleHeight > 200) {
                val seconds = when {
                    !post.videoUrl.isNullOrEmpty() -> 10
                    !post.audioUrl.isNullOrEmpty() -> 5
                    !post.imageUrl.isNullOrEmpty() -> 3
                    else -> 2
                }
                adapter.recordVisibleView(post._id, seconds)
            }

            if (!post.videoUrl.isNullOrEmpty() && visibleHeight > maxVisibleHeight) {
                maxVisibleHeight = visibleHeight
                mostVisible = i
            }
        }

        if (mostVisible != -1 && maxVisibleHeight > 200) {
            val post = posts.getOrNull(mostVisible)
            if (post != null) adapter.recordVisibleView(post._id, 10)
            adapter.playVideoAtPosition(mostVisible)
        }
    }

    private fun fetchCommunitiesAndFeed() {
        val auth = "Bearer $token"

        ApiClient.apiService.getCommunities(auth)
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fallbackCommunity()
                        return
                    }

                    allCommunities = response.body()!!
                    fetchUserMembership()
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    fallbackCommunity()
                }
            })
    }

    private fun fetchUserMembership() {
        val auth = "Bearer $token"

        ApiClient.apiService.getUserPrimaryCommunity(auth)
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    fetchJoinedCommunities(response.body()?.community)
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    fetchJoinedCommunities(null)
                }
            })
    }

    private fun fetchJoinedCommunities(primary: Community?) {
        val auth = "Bearer $token"

        ApiClient.apiService.getJoinedCommunities(auth)
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        fallbackCommunity()
                        return
                    }

                    val joined = response.body()!!.communities
                    selectedCommunities.clear()

                    primary?.let { selectedCommunities.add(it) }
                    selectedCommunities.addAll(joined)

                    if (selectedCommunities.isEmpty() && allCommunities.isNotEmpty()) {
                        selectedCommunities.add(allCommunities.first())
                    }

                    updateSelectedCommunitiesUI()
                    loadFeed()
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
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
        val text = selectedCommunities.joinToString(", ") { it.displayName ?: it.name ?: "Unknown" }
        selectedCommunitiesText.text = if (text.isEmpty()) "No community selected" else text

        communityNameView.text = when (selectedCommunities.size) {
            0 -> "No Community"
            1 -> selectedCommunities.first().displayName ?: selectedCommunities.first().name ?: "Unnamed"
            else -> "Multiple Communities"
        }
    }

    private fun loadFeed(page: Int = 1) {
        if (isLoading) return
        isLoading = true
        showLoading(true)

        val names = selectedCommunities.mapNotNull { it.displayName ?: it.name }
        if (names.isEmpty()) {
            posts.clear()
            adapter.updatePosts(posts)
            emptyView.visibility = View.VISIBLE
            showLoading(false)
            return
        }

        val namesString = names.joinToString(",")

        ApiClient.apiService.getPostsByCommunities(
            "Bearer $token",
            namesString,
            page,
            20
        ).enqueue(object : Callback<FeedResponse> {

            override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                isLoading = false
                showLoading(false)

                if (response.isSuccessful && response.body() != null) {
                    posts.clear()
                    posts.addAll(response.body()!!.posts)
                    adapter.updatePosts(posts)
                    emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
                    recyclerView.post { playVisibleVideo() }
                } else {
                    Toast.makeText(requireContext(), "Failed to load feed.", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                isLoading = false
                showLoading(false)
                Log.e("FeedFragment", "Network failure: ${t.message}")
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
                Log.e("FeedFragment", "Login track failed: ${t.message}")
            }
        })
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show && currentPage == 1) View.VISIBLE else View.GONE
    }

    private fun setupSocketListeners() {
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
                Log.e("FeedFragment", "Error parsing newPost")
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
                        posts[index] = posts[index].copy(likeCount = likeCount)
                        adapter.notifyItemChanged(index)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing likeUpdate")
            }
        }
    }

    override fun onPause() {
        super.onPause()
        adapter.pauseAllVideos()
    }

    override fun onResume() {
        super.onResume()
        recyclerView.post { playVisibleVideo() }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        adapter.pauseAllVideos()
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
    }
}
