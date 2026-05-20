package xyz.yenkasa.app.ui

import android.animation.ValueAnimator
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
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
import xyz.yenkasa.app.model.FeedResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.AppLinkManager
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.WalletBalanceManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.model.BlockUserRequest
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.ConversationStreak
import xyz.yenkasa.app.model.FlagRequest
import xyz.yenkasa.app.model.SearchResponse



class UserProfileActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var headerUsernameView: TextView
    private lateinit var usernameView: TextView
    private lateinit var iconVerified: ImageView
    private lateinit var iconHeaderVerified: ImageView
    private lateinit var rowLocation: LinearLayout
    private lateinit var locationView: TextView
    private lateinit var bioView: TextView
    private lateinit var rowExternalLink: LinearLayout
    private lateinit var externalLinkView: TextView
    private lateinit var rowJoined: LinearLayout
    private lateinit var joinedView: TextView
    private lateinit var followersCountView: TextView
    private lateinit var followingCountView: TextView
    private lateinit var postsCountView: TextView
    private lateinit var recyclerUserPosts: RecyclerView
    private lateinit var loadingPostsLayout: LinearLayout
    private lateinit var postsStateView: TextView
    private lateinit var btnFollow: Button
    private lateinit var btnMessage: Button
    private lateinit var btnBlock: Button
    private lateinit var btnMore: ImageButton
    private lateinit var conversationStreakLayout: LinearLayout
    private lateinit var conversationStreakView: TextView
    private lateinit var conversationStreakSubtitleView: TextView

    private lateinit var postAdapter: ProfilePostAdapter
    private val userPostsList = mutableListOf<Post>()

    private var userId: String? = null
    private var currentProfileUsername: String? = null
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
            Toast.makeText(this, R.string.user_not_found, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        fetchUserProfile()
    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        headerUsernameView = findViewById(R.id.textHeaderUsername)
        usernameView = findViewById(R.id.textUsername)
        iconVerified = findViewById(R.id.iconVerified)
        iconHeaderVerified = findViewById(R.id.iconHeaderVerified)
        rowLocation = findViewById(R.id.rowLocation)
        locationView = findViewById(R.id.textLocation)
        bioView = findViewById(R.id.textBio)
        rowExternalLink = findViewById(R.id.rowExternalLink)
        externalLinkView = findViewById(R.id.textExternalLink)
        rowJoined = findViewById(R.id.rowJoined)
        joinedView = findViewById(R.id.textJoined)
        followersCountView = findViewById(R.id.textFollowersCount)
        followingCountView = findViewById(R.id.textFollowingCount)
        postsCountView = findViewById(R.id.textPostsCount)
        recyclerUserPosts = findViewById(R.id.recyclerUserPosts)
        loadingPostsLayout = findViewById(R.id.layoutLoadingPosts)
        postsStateView = findViewById(R.id.textPostsState)
        btnFollow = findViewById(R.id.btnFollow)
        btnMessage = findViewById(R.id.btnMessage)
        btnBlock = findViewById(R.id.btnBlock)
        btnMore = findViewById(R.id.btnProfileActionMore)
        conversationStreakLayout = findViewById(R.id.layoutConversationStreak)
        conversationStreakView = findViewById(R.id.textConversationStreak)
        conversationStreakSubtitleView = findViewById(R.id.textConversationStreakSubtitle)

        btnFollow.backgroundTintList = null
        btnMessage.backgroundTintList = null
        btnBlock.backgroundTintList = null
    }

    private fun setupRecyclerView() {
        postAdapter = ProfilePostAdapter(userPostsList) { post -> openPostFromGrid(post) }

        recyclerUserPosts.layoutManager = GridLayoutManager(this, 3)
        recyclerUserPosts.setHasFixedSize(true)
        recyclerUserPosts.itemAnimator = null
        recyclerUserPosts.adapter = postAdapter
    }

    private fun setupListeners() {
        imageProfile.setOnClickListener {
            val intent = Intent(this, ProfileImagePreviewActivity::class.java)
            intent.putExtra("IMAGE_URL", imageProfile.tag as? String ?: "")
            startActivity(intent)
        }
        findViewById<View>(R.id.btnUserProfileBack).setOnClickListener { finish() }
        findViewById<View>(R.id.btnUserProfileMore).setOnClickListener {
            showProfileSafetyMenu(it)
        }
        btnMore.setOnClickListener {
            showProfileSafetyMenu(it)
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
                            val message = response.body()?.message ?: getString(R.string.could_not_open_chat)
                            Toast.makeText(this@UserProfileActivity, message, Toast.LENGTH_SHORT).show()
                        }
                    }

                    override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                        Toast.makeText(
                            this@UserProfileActivity,
                            getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                })
        }


        btnBlock.setOnClickListener { toggleBlockUser() }

        findViewById<View>(R.id.layoutFollowersStat).setOnClickListener { openFollowList("followers") }
        findViewById<View>(R.id.layoutFollowingStat).setOnClickListener { openFollowList("following") }
        followersCountView.setOnClickListener { openFollowList("followers") }
        followingCountView.setOnClickListener { openFollowList("following") }

        findViewById<View>(R.id.navUserProfileHome).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            })
            finish()
        }
        findViewById<View>(R.id.navUserProfileSearch).setOnClickListener {
            startActivity(Intent(this, CommunitiesActivity::class.java))
        }
        findViewById<View>(R.id.navUserProfileCreate).setOnClickListener {
            startActivity(Intent(this, PostActivity::class.java))
        }
        findViewById<View>(R.id.navUserProfileWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
        findViewById<View>(R.id.navUserProfileProfile).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }
    }

    private fun fetchUserProfile() {
        val token = TokenManager.getToken(this) ?: return
        val requestedIdentifier = userId ?: intent.getStringExtra("USER_ID") ?: return
        userId = requestedIdentifier

        val path = "profile/users/$requestedIdentifier/profile"
        showPostsLoading(getString(R.string.loading_posts))

        ApiClient.apiService.getProfileDynamic(path, "Bearer $token")
            .enqueue(object : Callback<ProfileResponse> {
                override fun onResponse(
                    call: Call<ProfileResponse>,
                    response: Response<ProfileResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val profile = response.body()!!
                        userId = profile._id
                        currentProfileUsername = profile.username
                        fetchConversationStreakIfOwnProfile()
                        updateUI(profile)
                        fetchUserPosts(profile._id, token)
                    } else if (response.code() == 404 && !AppLinkManager.isLikelyObjectId(requestedIdentifier)) {
                        resolveUserProfileIdentifier(requestedIdentifier, token)
                    } else {
                        Log.e(
                            TAG,
                            "❌ Profile load failed: ${response.code()} ${response.message()}"
                        )
                        showPostsMessage(getString(R.string.could_not_load_posts))
                    }
                }

                override fun onFailure(call: Call<ProfileResponse>, t: Throwable) {
                    Log.e(TAG, "⚠️ Network error while fetching profile: ${t.message}", t)
                    showPostsMessage(getString(R.string.could_not_load_posts))
                }
            })
    }

    private fun resolveUserProfileIdentifier(identifier: String, token: String) {
        ApiClient.apiService.searchYenkasa("Bearer $token", identifier)
            .enqueue(object : Callback<SearchResponse> {
                override fun onResponse(
                    call: Call<SearchResponse>,
                    response: Response<SearchResponse>
                ) {
                    val match = response.body()
                        ?.users
                        ?.firstOrNull {
                            it.username.equals(identifier, ignoreCase = true) ||
                                it.id.equals(identifier, ignoreCase = true)
                        }

                    if (response.isSuccessful && match != null) {
                        userId = match.id
                        fetchUserProfile()
                    } else {
                        Toast.makeText(this@UserProfileActivity, R.string.user_not_found, Toast.LENGTH_SHORT).show()
                        showPostsMessage(getString(R.string.could_not_load_posts))
                    }
                }

                override fun onFailure(call: Call<SearchResponse>, t: Throwable) {
                    Log.e(TAG, "⚠️ Failed to resolve profile identifier: ${t.message}", t)
                    showPostsMessage(getString(R.string.could_not_load_posts))
                }
            })
    }

    private fun fetchConversationStreakIfOwnProfile() {
        val targetUserId = userId.orEmpty()
        val currentUserId = TokenManager.getUserId(this).orEmpty()
        if (targetUserId.isBlank() || targetUserId != currentUserId) {
            conversationStreakLayout.visibility = View.GONE
            return
        }

        ApiClient.apiService.getConversationStreak()
            .enqueue(object : Callback<ConversationStreak> {
                override fun onResponse(
                    call: Call<ConversationStreak>,
                    response: Response<ConversationStreak>
                ) {
                    val streak = response.body()
                    if (!response.isSuccessful || streak == null) {
                        conversationStreakLayout.visibility = View.GONE
                        return
                    }
                    bindConversationStreak(streak)
                }

                override fun onFailure(call: Call<ConversationStreak>, t: Throwable) {
                    conversationStreakLayout.visibility = View.GONE
                }
            })
    }

    private fun bindConversationStreak(streak: ConversationStreak) {
        conversationStreakLayout.visibility = View.VISIBLE
        val prefix = if (streak.current >= 3) "🔥 " else ""
        val currentDays = resources.getQuantityString(R.plurals.profile_days_count, streak.current, streak.current)
        val longestDays = resources.getQuantityString(R.plurals.profile_days_count, streak.longest, streak.longest)
        conversationStreakSubtitleView.text = getString(R.string.conversation_streak_longest, longestDays)

        ValueAnimator.ofInt(0, streak.current).apply {
            duration = 450L
            addUpdateListener { animator ->
                val value = animator.animatedValue as Int
                val days = resources.getQuantityString(R.plurals.profile_days_count, value, value)
                conversationStreakView.text = getString(R.string.conversation_streak_value, prefix, days)
            }
            start()
        }
    }

    private fun fetchUserPosts(userId: String, token: String) {
        ApiClient.apiService.getUserPosts(
            userId = userId,
            token = "Bearer $token",
            page = 1,
            limit = 30
        ).enqueue(object : Callback<FeedResponse> {
            override fun onResponse(call: Call<FeedResponse>, response: Response<FeedResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    val fetchedPosts = response.body()!!.posts
                        .sortedByDescending { it.createdAt ?: "" }

                    Log.d(TAG, "✅ Loaded ${fetchedPosts.size} posts from /posts/user/$userId")

                    userPostsList.clear()
                    userPostsList.addAll(fetchedPosts)
                    postAdapter.submitPosts(fetchedPosts)
                    postsCountView.text = fetchedPosts.size.toString()
                    showPostsContent(fetchedPosts.isNotEmpty())
                } else {
                    Log.e(TAG, "❌ User posts load failed: ${response.code()} ${response.message()}")
                    showPostsMessage(
                        if (response.code() == 404) "Posts route not available."
                        else if (response.code() == 403) "You cannot view this user's posts."
                        else "Could not load posts."
                    )
                }
            }

            override fun onFailure(call: Call<FeedResponse>, t: Throwable) {
                Log.e(TAG, "⚠️ Network error while fetching user posts: ${t.message}", t)
                showPostsMessage("Could not load posts.")
            }
        })
    }

    private fun updateUI(profile: ProfileResponse) {
        if (isFinishing || isDestroyed) return

        currentProfileUsername = profile.username
        headerUsernameView.text = profile.username
        usernameView.text = profile.username
        followersCountView.text = (profile.followersCount ?: profile.followers.size).toString()
        followingCountView.text = (profile.followingCount ?: profile.following.size).toString()
        postsCountView.text = (profile.posts?.size ?: 0).toString()

        val verified = profile.verified == true
        iconVerified.visibility = if (verified) View.VISIBLE else View.GONE
        iconHeaderVerified.visibility = if (verified) View.VISIBLE else View.GONE

        val locationText = profile.location?.takeIf { it.isNotBlank() }
            ?: profile.community?.name?.takeIf { it.isNotBlank() }
            ?: "Location"
        locationView.text = locationText
        rowLocation.visibility = View.VISIBLE

        bioView.text = profile.bio?.takeIf { it.isNotBlank() } ?: "No bio yet."

        val externalLink = profile.externalLink?.takeIf { it.isNotBlank() }
            ?: profile.website?.takeIf { it.isNotBlank() }
        rowExternalLink.visibility = if (externalLink.isNullOrBlank()) View.GONE else View.VISIBLE
        externalLinkView.text = externalLink.orEmpty()
        rowExternalLink.setOnClickListener {
            openExternalLink(externalLink)
        }

        val joinedText = formatJoinDate(profile.createdAt)
        rowJoined.visibility = if (joinedText == null) View.GONE else View.VISIBLE
        joinedView.text = joinedText.orEmpty()

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

        updateActionButtons()
    }

    private fun showPostsLoading(message: String) {
        recyclerUserPosts.visibility = View.GONE
        loadingPostsLayout.visibility = View.VISIBLE
        postsStateView.text = message
    }

    private fun showPostsContent(hasPosts: Boolean) {
        recyclerUserPosts.visibility = if (hasPosts) View.VISIBLE else View.GONE
        loadingPostsLayout.visibility = if (hasPosts) View.GONE else View.VISIBLE
        postsStateView.text = if (hasPosts) "" else getString(R.string.no_posts_yet)
    }

    private fun showPostsMessage(message: String) {
        recyclerUserPosts.visibility = View.GONE
        loadingPostsLayout.visibility = View.VISIBLE
        postsStateView.text = message
    }

    private fun updateActionButtons() {
        btnFollow.text = if (isFollowing) getString(R.string.following) else getString(R.string.follow)
        btnFollow.setBackgroundResource(
            if (isFollowing) R.drawable.bg_profile_secondary_button else R.drawable.bg_profile_follow_button
        )
        btnFollow.setTextColor(
            ContextCompat.getColor(this, if (isFollowing) R.color.account_primary_text else R.color.white)
        )

        btnBlock.text = if (isBlocked) getString(R.string.unblock) else getString(R.string.block)
        btnBlock.setTextColor(
            ContextCompat.getColor(this, if (isBlocked) R.color.account_accent_green else R.color.account_danger)
        )
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
                    updateActionButtons()

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
                        R.string.failed_to_update_follow,
                        Toast.LENGTH_SHORT
                    ).show()
                }
                btnFollow.isEnabled = true
            }

            override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                btnFollow.isEnabled = true
                Toast.makeText(
                    this@UserProfileActivity,
                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
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
                    updateActionButtons()
                } else {
                    Toast.makeText(this@UserProfileActivity, R.string.failed_to_update_block, Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                Toast.makeText(
                    this@UserProfileActivity,
                    getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun showProfileSafetyMenu(anchor: View) {
        PopupMenu(this, anchor).apply {
            menu.add(getString(R.string.share_profile))
            menu.add(getString(R.string.report_user))
            setOnMenuItemClickListener {
                when (it.title) {
                    getString(R.string.share_profile) -> shareProfile()
                    else -> showReportUserDialog()
                }
                true
            }
            show()
        }
    }

    private fun shareProfile() {
        val identifier = currentProfileUsername?.takeIf { it.isNotBlank() }
            ?: userId?.takeIf { it.isNotBlank() }
            ?: run {
                Toast.makeText(this, R.string.user_not_found, Toast.LENGTH_SHORT).show()
                return
            }

        val shareUrl = AppLinkManager.buildProfileUrl(identifier)
        val shareText = AppLinkManager.buildShareText(usernameView.text?.toString(), shareUrl)
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_SUBJECT, getString(R.string.share_profile_subject))
                    putExtra(Intent.EXTRA_TEXT, shareText)
                },
                getString(R.string.share_via)
            )
        )
    }

    private fun showReportUserDialog() {
        val reasons = listOf(
            getString(R.string.report_reason_harassment) to "Harassment or bullying",
            getString(R.string.report_reason_hate) to "Hate or abusive content",
            getString(R.string.report_reason_spam) to "Spam or scam",
            getString(R.string.report_reason_impersonation) to "Impersonation",
            getString(R.string.report_reason_sexual_unsafe) to "Sexual or unsafe content",
            getString(R.string.other) to "Other"
        )

        AlertDialog.Builder(this)
            .setTitle(R.string.report_user)
            .setItems(reasons.map { it.first }.toTypedArray()) { _, which ->
                reportUser(reasons[which].second)
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun reportUser(reason: String) {
        val targetId = userId ?: return
        ApiClient.apiService.reportUser(targetId, FlagRequest(reason))
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    val message = response.body()?.message ?: if (response.isSuccessful) {
                        getString(R.string.report_submitted)
                    } else {
                        getString(R.string.failed_to_submit_report)
                    }
                    Toast.makeText(this@UserProfileActivity, message, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Toast.makeText(
                        this@UserProfileActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
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

    private fun openExternalLink(rawUrl: String?) {
        if (rawUrl.isNullOrBlank()) return
        val normalizedUrl = if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
            rawUrl
        } else {
            "https://$rawUrl"
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(normalizedUrl)))
    }

    private fun formatJoinDate(createdAt: String?): String? {
        if (createdAt.isNullOrBlank()) return null
        val parsed = runCatching {
            java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(createdAt)
        }.getOrNull() ?: return null

        val formatted = java.text.SimpleDateFormat("MMMM yyyy", java.util.Locale.US).format(parsed)
        return "Joined $formatted"
    }
}
