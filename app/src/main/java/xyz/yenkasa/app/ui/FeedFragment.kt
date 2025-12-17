package xyz.yenkasa.app.ui

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
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.FeedAdapter
import xyz.yenkasa.app.model.*
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.adapter.AdBinder


class FeedFragment : Fragment() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var communityNameView: TextView
    private lateinit var fabCreatePost: FloatingActionButton
    private lateinit var btnSelectCommunities: LinearLayout
    private lateinit var selectedCommunitiesText: TextView

    private val posts = mutableListOf<Post>()
    private lateinit var feedAdapter: FeedAdapter

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

        feedAdapter = FeedAdapter(
            requireContext(),
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

                        val mixed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixed)
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
            onShareClick = { post -> sharePost(post) },
            adAdapterCallbacks = AdBinder(requireContext())
        )
// 🔥 CONNECT POST OPTIONS (delete / hide / flag / download)
        feedAdapter.onDelete = { post ->
            confirmDeletePost(post)
        }

        feedAdapter.onHide = { post ->
            hidePost(post)
        }

        feedAdapter.onFlag = { post ->
            flagPost(post)
        }

        feedAdapter.onDownload = { post ->
            downloadPost(post)
        }

        recyclerView.layoutManager = layoutManager
        recyclerView.adapter = feedAdapter
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
        intent.putExtra("POST_ID", post._id)
        intent.putExtra("USERNAME", post.userId.username)
        intent.putExtra("CAPTION", post.caption ?: "")
        startActivity(intent)
    }


    private fun openAudio(post: Post) {
        val intent = Intent(requireContext(), PostMediaActivity::class.java)
        intent.putExtra("MEDIA_URL", post.audioUrl)
        intent.putExtra("MEDIA_TYPE", "audio")
        intent.putExtra("POST_ID", post._id)
        intent.putExtra("USERNAME", post.userId.username)
        intent.putExtra("CAPTION", post.caption ?: "")
        startActivity(intent)
    }


    private fun sharePost(post: Post) {
        val shareIntent = Intent(Intent.ACTION_SEND)
        shareIntent.type = "text/plain"
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
        shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
        startActivity(Intent.createChooser(shareIntent, "Share via"))
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


    private fun buildMixedFeed(posts: List<Post>): List<Any> {
        val mixed = mutableListOf<Any>()
        var counter = 0

        for (post in posts) {
            mixed.add(post)
            counter++

            if (counter % 5 == 0) {
                mixed.add(
                    AdModel(
                        _id = "local-ad-${counter}",
                        sponsorName = "AdMob",
                        title = "Sponsored Ad",
                        imageUrl = null,
                        videoUrl = null,
                        thumbnailUrl = null,
                        ctaUrl = null,
                        ctaText = "Learn More",
                        rewardYKC = 0
                    )
                )
            }
        }

        return mixed
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
            val mixedList = buildMixedFeed(posts)
            feedAdapter.updateItems(mixedList)

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
                    val mixedList = buildMixedFeed(posts)
                    feedAdapter.updateItems(mixedList)
                    emptyView.visibility = if (posts.isEmpty()) View.VISIBLE else View.GONE
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
                    val mixed = buildMixedFeed(posts)
                    feedAdapter.updateItems(mixed)

                    recyclerView.scrollToPosition(0)
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing newPost")
            }
        }
        SocketManager.on("viewUpdate") { data ->
            try {
                val json = data as JSONObject
                val postId = json.getString("postId")
                val viewsCount = json.getInt("viewsCount")

                lifecycleScope.launch {
                    val index = posts.indexOfFirst { it._id == postId }
                    if (index >= 0) {
                        posts[index] = posts[index].copy(viewCount = viewsCount)
                        val mixed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixed)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing viewUpdate: ${e.message}")
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
                        val mixed = buildMixedFeed(posts)
                        feedAdapter.updateItems(mixed)
                    }
                }
            } catch (e: Exception) {
                Log.e("FeedFragment", "Error parsing likeUpdate")
            }
        }
    }

    private fun confirmDeletePost(post: Post) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete post")
            .setMessage("Are you sure you want to delete this post?")
            .setPositiveButton("Delete") { _, _ ->
                deletePost(post)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun downloadPost(post: Post) {
        ApiClient.apiService.getPostMedia(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<MediaResponse> {

            override fun onResponse(
                call: Call<MediaResponse>,
                response: Response<MediaResponse>
            ) {
                if (!response.isSuccessful || response.body() == null) {
                    Toast.makeText(requireContext(), "Failed to get media", Toast.LENGTH_SHORT).show()
                    return
                }

                val media = response.body()!!.media

                val url = media.imageUrl
                    ?: media.videoUrl
                    ?: media.audioUrl

                if (url.isNullOrEmpty()) {
                    Toast.makeText(requireContext(), "No media found", Toast.LENGTH_SHORT).show()
                    return
                }

                // Open system downloader / browser
                startActivity(
                    Intent(Intent.ACTION_VIEW).apply {
                        data = android.net.Uri.parse(url)
                    }
                )
            }

            override fun onFailure(call: Call<MediaResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Download failed", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun deletePost(post: Post) {
        ApiClient.apiService.deletePost(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                if (response.isSuccessful) {
                    posts.removeAll { it._id == post._id }
                    feedAdapter.updateItems(buildMixedFeed(posts))
                    Toast.makeText(requireContext(), "Post deleted", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(requireContext(), "Delete failed", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Network error", Toast.LENGTH_SHORT).show()
            }
        })
    }
    private fun hidePost(post: Post) {
        ApiClient.apiService.hidePost(
            post._id,
            "Bearer $token"
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                posts.removeAll { it._id == post._id }
                feedAdapter.updateItems(buildMixedFeed(posts))
                Toast.makeText(requireContext(), "Post hidden", Toast.LENGTH_SHORT).show()
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(requireContext(), "Failed to hide post", Toast.LENGTH_SHORT).show()
            }
        })
    }
    private fun flagPost(post: Post) {
        val request = FlagRequest(
            reason = "inappropriate"
        )

        ApiClient.apiService.flagPost(
            post._id,
            "Bearer $token",
            request
        ).enqueue(object : Callback<GenericResponse> {

            override fun onResponse(
                call: Call<GenericResponse>,
                response: Response<GenericResponse>
            ) {
                if (response.isSuccessful) {
                    Toast.makeText(
                        requireContext(),
                        "Post reported successfully",
                        Toast.LENGTH_SHORT
                    ).show()
                } else {
                    Toast.makeText(
                        requireContext(),
                        "Failed to report post",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                Toast.makeText(
                    requireContext(),
                    "Report failed: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    override fun onResume() {
        super.onResume()
    }

    override fun onPause() {
        super.onPause()
        feedAdapter.pauseAllVideos()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        feedAdapter.pauseAllVideos()
        SocketManager.off("newPost")
        SocketManager.off("likeUpdate")
    }

}
