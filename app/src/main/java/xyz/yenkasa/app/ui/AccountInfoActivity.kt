package xyz.yenkasa.app.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
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
import xyz.yenkasa.app.databinding.ActivityAccountInfoBinding
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.FollowResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import xyz.yenkasa.app.util.UserBadgeUtils
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.*

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var iconVerified: ImageView
    private lateinit var usernameView: TextView
    private lateinit var emailView: TextView
    private lateinit var phoneView: TextView
    private lateinit var locationView: TextView
    private lateinit var coinsBalanceView: TextView
    private lateinit var communityView: TextView
    private lateinit var dateJoinedView: TextView
    private lateinit var followersCountView: TextView
    private lateinit var followingCountView: TextView
    private lateinit var postsCountView: TextView
    private lateinit var recyclerUserPosts: RecyclerView
    private lateinit var btnEditProfile: View
    private lateinit var binding: ActivityAccountInfoBinding
    private lateinit var textRole: TextView



    private lateinit var postAdapter: ProfilePostAdapter
    private val userPostsList = mutableListOf<Post>()
    private val TAG = "AccountInfoActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        bindViews()
        setupRecyclerView()
        setupListeners()
        loadProfileFromCache()
        fetchUserProfile()
        loadUserCommunities()
        loadUserPosts()


    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        iconVerified = findViewById(R.id.iconVerified)
        usernameView = findViewById(R.id.textUsername)
        emailView = findViewById(R.id.textEmail)
        phoneView = findViewById(R.id.textPhone)
        locationView = findViewById(R.id.textLocation)
        coinsBalanceView = findViewById(R.id.textCoinsBalance)
        communityView = findViewById(R.id.textCommunity)
        dateJoinedView = findViewById(R.id.textDateJoined)
        followersCountView = findViewById(R.id.textFollowersCount)
        followingCountView = findViewById(R.id.textFollowingCount)
        postsCountView = findViewById(R.id.textPostsCount)
        recyclerUserPosts = findViewById(R.id.recyclerUserPosts)
        btnEditProfile = findViewById(R.id.btnEditSave)
        textRole = findViewById(R.id.textRole)

    }

// ... (imports and other class members)

    private fun setupRecyclerView() {
        postAdapter = ProfilePostAdapter(userPostsList) { post -> openPostFromGrid(post) }

        recyclerUserPosts.apply {
            layoutManager = GridLayoutManager(this@AccountInfoActivity, 3)
            adapter = postAdapter
        }
    }

// ... (rest of the file)

    private fun setupListeners() {
        btnEditProfile.setOnClickListener {
            startActivity(Intent(this, EditProfileActivity::class.java))
        }
        findViewById<View>(R.id.btnAccountBack).setOnClickListener { finish() }
        findViewById<View>(R.id.btnAccountSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        findViewById<View>(R.id.btnAccountWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
        findViewById<View>(R.id.btnAccountSecurity).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
        findViewById<View>(R.id.btnAccountLogout).setOnClickListener {
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
        findViewById<View>(R.id.navAccountHome).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
            finish()
        }
        findViewById<View>(R.id.navAccountWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
        findViewById<View>(R.id.navAccountSend).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java))
        }
        findViewById<View>(R.id.navAccountReceive).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java).putExtra("action", "receive"))
        }
        followersCountView.setOnClickListener { openFollowList("followers") }
        followingCountView.setOnClickListener { openFollowList("following") }
    }

    private fun loadProfileFromCache() {
        usernameView.text = TokenManager.getUsername(this) ?: "Unknown"
        emailView.text = TokenManager.getEmail(this) ?: "Not provided"
        phoneView.text = TokenManager.getPhone(this) ?: "Not provided"
        locationView.text = TokenManager.getLocation(this) ?: "No location"
        coinsBalanceView.text = formatCoins(TokenManager.getCoinsPrecise(this))
        communityView.text = "Community: None"
        dateJoinedView.text = "Joined: Unknown"

        Glide.with(this)
            .load(TokenManager.getProfilePicUrl(this) ?: R.drawable.default_avatar)
            .apply(RequestOptions.circleCropTransform())
            .into(imageProfile)

        if (TokenManager.isVerified(this)) {
            iconVerified.visibility = View.VISIBLE
        } else {
            iconVerified.visibility = View.GONE
        }
    }

    private fun fetchUserProfile() {
        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful && response.body() != null) {
                        val user = response.body()!!
                        updateUI(user)

                        // ✅ Save user info
                        TokenManager.saveUserDetails(
                            this@AccountInfoActivity,
                            user._id,
                            user.username,
                            user.email,
                            user.phone,
                            user.verified,
                            user.profileImage,
                            user.location
                        )

                        // ✅ Prefer using roleName sent directly from backend
                        val roleName = user.roleName ?: user.role?.name ?: "user"

// If backend still sends full role object, access permissions
                        val perms = user.role?.permissions

                        Log.i("AccountInfoActivity", "User RoleName: $roleName")

// ✅ Determine permissions using UserPermissions logic
                        val canPost = UserPermissions.canPost(roleName, user.verified)
                        val canApprove = UserPermissions.canApprove(roleName)
                        val canSuspend = UserPermissions.canSuspend(roleName)
                        val canAssign = UserPermissions.canAssignRoles(roleName)
                        val canRevoke = UserPermissions.canRevoke(roleName)

// Debug logging
                        Log.i("AccountInfoActivity", "canPost=$canPost, canApprove=$canApprove, canSuspend=$canSuspend, canAssign=$canAssign, canRevoke=$canRevoke")

// Save role flags
                        when (roleName.lowercase()) {
                            "admin" -> {
                                TokenManager.setAdmin(this@AccountInfoActivity, true)
                                TokenManager.setModerator(this@AccountInfoActivity, false)
                                TokenManager.setDeveloper(this@AccountInfoActivity, false)
                            }
                            "moderator" -> {
                                TokenManager.setAdmin(this@AccountInfoActivity, false)
                                TokenManager.setModerator(this@AccountInfoActivity, true)
                                TokenManager.setDeveloper(this@AccountInfoActivity, false)
                            }
                            "senior_developer", "junior_developer" -> {
                                TokenManager.setAdmin(this@AccountInfoActivity, true)
                                TokenManager.setModerator(this@AccountInfoActivity, true)
                                TokenManager.setDeveloper(this@AccountInfoActivity, true)
                            }
                            else -> {
                                TokenManager.setAdmin(this@AccountInfoActivity, false)
                                TokenManager.setModerator(this@AccountInfoActivity, false)
                                TokenManager.setDeveloper(this@AccountInfoActivity, false)
                            }
                        }


                        // ✅ Continue app logic
                        fetchFollowStats(user._id)
                    } else {
                        Toast.makeText(this@AccountInfoActivity, "Failed to load profile", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e(TAG, "Error fetching user profile: ${t.message}")
                }
            })
    }

    // 🔹 New method to get follow stats
    private fun fetchFollowStats(userId: String?) {
        val token = TokenManager.getToken(this) ?: return
        val currentUserId = TokenManager.getUserId(this) ?: return

        ApiClient.apiService.getFollowStats(currentUserId, "Bearer $token")
            .enqueue(object : Callback<FollowResponse> {
                override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        val stats = response.body()!!
                        followersCountView.text = "${stats.followersCount}\nFollowers"
                        followingCountView.text = "${stats.followingCount}\nFollowing"
                    }
                }

                override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                    Log.e(TAG, "Failed to fetch follow stats: ${t.message}")
                }
            })
    }


    private fun updateUI(user: User) {
        usernameView.text = user.username
        emailView.text = user.email ?: "Not provided"
        phoneView.text = user.phone ?: "Not provided"
        locationView.text = user.location ?: "No location"
        TokenManager.saveCoinsPrecise(this, user.coinsBalance)
        coinsBalanceView.text = formatCoins(user.coinsBalance)

        // ✅ Correct property — your Community model uses displayName, not name
        communityView.text = "Communities: Loading..."
        dateJoinedView.text = "Joined: ${formatDate(user.createdAt)}"

        val roleName = user.roleName ?: user.role?.name ?: "user"
        UserBadgeUtils.applyBadge(iconVerified, user.verified, roleName, user.role)

        val displayRole = roleName.replace("_", " ")
            .replaceFirstChar { it.uppercase() }

        textRole.text = displayRole


        Glide.with(this)
            .load(user.profileImage ?: R.drawable.default_avatar)
            .apply(
                RequestOptions()
                    .placeholder(R.drawable.ic_user_placeholder)
                    .error(R.drawable.ic_user_placeholder)
                    .circleCrop()
            )
            .into(imageProfile)
    }

    private fun loadUserCommunities() {
        val token = TokenManager.getToken(this) ?: return

        var primaryCommunity: Community? = null

        // 1️⃣ Fetch PRIMARY community
        ApiClient.apiService.getUserPrimaryCommunity("Bearer $token")
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    if (response.isSuccessful && response.body()?.community != null) {
                        primaryCommunity = response.body()!!.community
                    }

                    // Continue to fetch joined communities
                    loadJoinedCommunitiesForAccount(primaryCommunity)
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    loadJoinedCommunitiesForAccount(primaryCommunity)
                }
            })
    }

    private fun loadJoinedCommunitiesForAccount(primary: Community?) {
        val token = TokenManager.getToken(this) ?: return

        ApiClient.apiService.getJoinedCommunities("Bearer $token")
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        communityView.text = "Communities: None"
                        return
                    }

                    val joined = response.body()!!.communities
                    val finalList = mutableListOf<Community>()

                    // Add PRIMARY first (if exists & not duplicated)
                    primary?.let {
                        if (!joined.any { c -> c.id == primary.id }) {
                            finalList.add(primary)
                        }
                    }

                    // Add JOINED
                    finalList.addAll(joined)

                    if (finalList.isEmpty()) {
                        communityView.text = "Communities: None"
                        return
                    }

                    val text = finalList.joinToString(", ") {
                        it.displayName ?: it.name ?: "Unknown"
                    }

                    communityView.text = "Communities: $text"
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
                    communityView.text = "Communities: Failed to load"
                }
            })
    }


    private fun loadUserPosts() {
        val token = TokenManager.getToken(this) ?: return
        ApiClient.apiService.getMyPosts("Bearer $token")
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    if (response.isSuccessful && response.body() != null) {
                        val allPosts = response.body()!!
                        Log.d(TAG, "✅ User posts loaded: $allPosts")

                        userPostsList.clear()
                        userPostsList.addAll(allPosts)
                        postAdapter.submitPosts(allPosts)

                        postsCountView.text = "${allPosts.size}\nPosts"
                    } else {
                        Log.w(TAG, "⚠️ Failed to load posts: ${response.code()} - ${response.message()}")
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Log.e(TAG, "❌ Posts load failed: ${t.message}", t)
                }
            })
    }

    private fun formatDate(dateStr: String?): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            val date = parser.parse(dateStr ?: "")
            val formatter = SimpleDateFormat("dd MMM yyyy", Locale.getDefault())
            formatter.format(date!!)
        } catch (e: Exception) {
            "Unknown"
        }
    }

    private fun formatCoins(coins: Double): String {
        val formatter = NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            minimumFractionDigits = 0
            maximumFractionDigits = if (coins % 1.0 == 0.0) 0 else 2
        }
        return formatter.format(coins)
    }

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowFeedActivity::class.java)
        intent.putExtra("LIST_TYPE", type) // "followers" or "following"
        intent.putExtra("USER_ID", TokenManager.getUserId(this))
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
