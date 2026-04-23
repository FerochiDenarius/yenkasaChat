package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ProfilePostAdapter
import xyz.yenkasa.app.model.UnblockUserRequest
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.ProfileResponse
import xyz.yenkasa.app.model.FollowResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.model.BlockUserRequest
import xyz.yenkasa.app.model.ApiResponse



class UserProfileActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextView
    private lateinit var followersCountView: TextView
    private lateinit var followingCountView: TextView
    private lateinit var postsCountView: TextView
    private lateinit var recyclerUserPosts: RecyclerView
    private lateinit var btnFollow: Button
    private lateinit var btnMessage: Button
    private lateinit var btnBlock: Button

    private lateinit var postAdapter: ProfilePostAdapter
    private val userPostsList = mutableListOf<Post>()

    private var userId: String? = null
    private var isFollowing = false
    private var isBlocked = false

    private val TAG = "UserProfileActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_user_profile)

        bindViews()
        setupRecyclerView()
        setupListeners()

        userId = intent.getStringExtra("USER_ID")
        if (userId.isNullOrEmpty()) {
            Toast.makeText(this, "User not found", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        fetchUserProfile()
    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        usernameView = findViewById(R.id.textUsername)
        followersCountView = findViewById(R.id.textFollowersCount)
        followingCountView = findViewById(R.id.textFollowingCount)
        postsCountView = findViewById(R.id.textPostsCount)
        recyclerUserPosts = findViewById(R.id.recyclerUserPosts)
        btnFollow = findViewById(R.id.btnFollow)
        btnMessage = findViewById(R.id.btnMessage)
        btnBlock = findViewById(R.id.btnBlock)
    }

    private fun setupRecyclerView() {
        postAdapter = ProfilePostAdapter(userPostsList) { post -> openPostFromGrid(post) }

        recyclerUserPosts.layoutManager = GridLayoutManager(this, 3)
        recyclerUserPosts.adapter = postAdapter
    }

    private fun setupListeners() {
        imageProfile.setOnClickListener {
            val intent = Intent(this, ProfileImagePreviewActivity::class.java)
            intent.putExtra("IMAGE_URL", imageProfile.tag as? String ?: "")
            startActivity(intent)
        }

        btnFollow.setOnClickListener { toggleFollowUser() }

        btnMessage.setOnClickListener {
            if (userId.isNullOrEmpty()) return@setOnClickListener

            val request = CreateChatRoomRequest(username = usernameView.text.toString())

            ApiClient.apiService.createChatRoom(request)
                .enqueue(object : Callback<CreateChatRoomResponse> {
                    override fun onResponse(
                        call: Call<CreateChatRoomResponse>,
                        response: Response<CreateChatRoomResponse>
                    ) {
                        if (response.isSuccessful && response.body() != null && response.body()!!.success) {
                            val roomId = response.body()!!.roomId

                            val intent = Intent(this@UserProfileActivity, ChatActivity::class.java)
                            intent.putExtra("roomId", roomId)
                            startActivity(intent)
                        } else {
                            Toast.makeText(this@UserProfileActivity, "Could not open chat", Toast.LENGTH_SHORT).show()
                        }
                    }

                    override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                        Toast.makeText(this@UserProfileActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                    }
                })
        }


        btnBlock.setOnClickListener { toggleBlockUser() }

        followersCountView.setOnClickListener { openFollowList("followers") }
        followingCountView.setOnClickListener { openFollowList("following") }
    }

    private fun fetchUserProfile() {
        val token = TokenManager.getToken(this) ?: return
        val userId = intent.getStringExtra("USER_ID") ?: return

        val path = "profile/users/$userId/profile"

        ApiClient.apiService.getProfileDynamic(path, "Bearer $token")
            .enqueue(object : Callback<ProfileResponse> {
                override fun onResponse(
                    call: Call<ProfileResponse>,
                    response: Response<ProfileResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val profile = response.body()!!
                        updateUI(profile)

                        val profilePosts = profile.posts ?: emptyList()

                        Log.d(
                            TAG,
                            "✅ Loaded ${profilePosts.size} posts for user ${profile.username}"
                        )

                        // ✅ Update RecyclerView
                        userPostsList.clear()
                        userPostsList.addAll(profilePosts)
                        postAdapter.submitPosts(profilePosts)

                        // ✅ Update UI count
                        postsCountView.text = "${profilePosts.size}\nPosts"
                    } else {
                        Log.e(
                            TAG,
                            "❌ Profile load failed: ${response.code()} ${response.message()}"
                        )
                    }
                }

                override fun onFailure(call: Call<ProfileResponse>, t: Throwable) {
                    Log.e(TAG, "⚠️ Network error while fetching profile: ${t.message}", t)
                }
            })
    }

    private fun updateUI(profile: ProfileResponse) {
        if (isFinishing || isDestroyed) return

        usernameView.text = profile.username
        followersCountView.text = "${profile.followersCount ?: profile.followers.size}\nFollowers"
        followingCountView.text = "${profile.followingCount ?: profile.following.size}\nFollowing"
        postsCountView.text = "${profile.posts?.size ?: 0}\nPosts"

        val rawImageUrl = profile.profileImage?.trim().orEmpty()
        val imageUrl = when {
            rawImageUrl.isBlank() || rawImageUrl == "null" -> null
            rawImageUrl.startsWith("http") -> rawImageUrl
            else -> "https://yenkasa.xyz/${rawImageUrl.trimStart('/')}"
        }

        Glide.with(imageProfile)
            .load(imageUrl)
            .placeholder(R.drawable.ic_user_placeholder)
            .error(R.drawable.ic_user_placeholder)
            .apply(RequestOptions.circleCropTransform())
            .into(imageProfile)

        imageProfile.tag = imageUrl.orEmpty()

        isFollowing = profile.isFollowing
        isBlocked = profile.isBlocked

        btnFollow.text = if (isFollowing) "Unfollow" else "Follow"
        btnBlock.text = if (isBlocked) "Unblock" else "Block"
    }

    private fun toggleFollowUser() {
        val token = TokenManager.getToken(this) ?: return
        if (userId.isNullOrEmpty()) return

        btnFollow.isEnabled = false
        val call = if (isFollowing) {
            ApiClient.apiService.unfollowUser(userId!!, "Bearer $token")
        } else {
            ApiClient.apiService.followUser(userId!!, "Bearer $token")
        }

        call.enqueue(object : Callback<FollowResponse> {
            override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                val result = response.body()
                if (response.isSuccessful && result != null) {
                    WalletBalanceManager.refreshAfterReward(this@UserProfileActivity, result.coinsRewarded)
                    isFollowing = result.isFollowing ?: !isFollowing
                    btnFollow.text = if (isFollowing) "Unfollow" else "Follow"

                    Toast.makeText(
                        this@UserProfileActivity,
                        result.message,
                        Toast.LENGTH_SHORT
                    ).show()

                    fetchUserProfile()
                } else {
                    Log.e(TAG, "Follow update failed: ${response.code()} ${response.errorBody()?.string()}")
                    Toast.makeText(
                        this@UserProfileActivity,
                        "Failed to update follow",
                        Toast.LENGTH_SHORT
                    ).show()
                }
                btnFollow.isEnabled = true
            }

            override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                btnFollow.isEnabled = true
                Toast.makeText(
                    this@UserProfileActivity,
                    "Network error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun toggleBlockUser() {
        val targetId = userId ?: return

        val call = if (isBlocked) {
            ApiClient.apiService.unblockUser(UnblockUserRequest(targetId))
        } else {
            ApiClient.apiService.blockUser(BlockUserRequest(targetId))
        }

        call.enqueue(object : Callback<ApiResponse> {
            override fun onResponse(
                call: Call<ApiResponse>,
                response: Response<ApiResponse>
            ) {
                if (response.isSuccessful && response.body() != null) {
                    val message = response.body()!!.message
                    Toast.makeText(this@UserProfileActivity, message, Toast.LENGTH_SHORT).show()

                    if (isBlocked) {
                        TokenManager.removeBlockedUser(this@UserProfileActivity, targetId)
                    } else {
                        TokenManager.addBlockedUser(this@UserProfileActivity, targetId)
                    }

                    // Update UI
                    isBlocked = !isBlocked
                    btnBlock.text = if (isBlocked) "Unblock" else "Block"
                } else {
                    Toast.makeText(this@UserProfileActivity, "Failed to update block", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(this@UserProfileActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowFeedActivity::class.java)
        intent.putExtra("LIST_TYPE", type) // "followers" or "following"
        intent.putExtra("USER_ID", userId ?: TokenManager.getUserId(this))
        startActivity(intent)
    }

    private fun openPostFromGrid(post: Post) {
        val mediaUrl = post.effectiveImageUrls().firstOrNull()?.takeIf { it.isNotBlank() }
            ?: post.videoUrl?.takeIf { it.isNotBlank() }
            ?: post.audioUrl?.takeIf { it.isNotBlank() }

        if (mediaUrl.isNullOrBlank()) {
            startActivity(Intent(this, CommentsActivity::class.java).putExtra("POST_ID", post._id))
            return
        }

        startActivity(Intent(this, PostMediaActivity::class.java).apply {
            putExtra("POST_ID", post._id)
            putExtra("MEDIA_URL", mediaUrl)
            putExtra(
                "MEDIA_TYPE",
                when {
                    !post.videoUrl.isNullOrEmpty() -> "video"
                    !post.audioUrl.isNullOrEmpty() -> "audio"
                    else -> "image"
                }
            )
            putExtra("USERNAME", post.userId.username)
            putExtra("CAPTION", post.caption ?: "")
        })
    }
}
