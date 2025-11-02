package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.Community
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
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
    private lateinit var btnEditProfile: Button

    private lateinit var postAdapter: PostAdapter
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
    }

// ... (imports and other class members)

    private fun setupRecyclerView() {
        // ✅ FIX: Provide all required lambda functions to the adapter's constructor
        postAdapter = PostAdapter(
            posts = userPostsList,
            onPostClick = { post ->
                // When a user clicks a post in the grid, open the detail view
                val intent = Intent(this, PostDetailActivity::class.java)
                intent.putExtra("POST_ID", post._id)
                startActivity(intent)
            },
            onLikeClick = { _, _ -> /* Not needed in this grid view */ },
            onCommentClick = { _, _ -> /* Not needed in this grid view */ },
            onUserClick = { /* Not needed, we are already on a user's profile */ },
            onShareClick = { post ->
                // Optional: implement sharing or leave empty if not needed
                val shareIntent = Intent(Intent.ACTION_SEND)
                shareIntent.type = "text/plain"
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Check out this post")
                shareIntent.putExtra(Intent.EXTRA_TEXT, post.caption ?: "")
                startActivity(Intent.createChooser(shareIntent, "Share via"))
            }
        )

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
        followersCountView.setOnClickListener { openFollowList("followers") }
        followingCountView.setOnClickListener { openFollowList("following") }
    }

    private fun loadProfileFromCache() {
        usernameView.text = TokenManager.getUsername(this) ?: "Unknown"
        emailView.text = TokenManager.getEmail(this) ?: "Not provided"
        phoneView.text = TokenManager.getPhone(this) ?: "Not provided"
        locationView.text = TokenManager.getLocation(this) ?: "No location"
        coinsBalanceView.text = "YenkasaCoins: 0"
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

                        // ✅ Save user roles locally
                        when (user.role?.lowercase()) {
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
                            "developer" -> {
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

                        Log.i("AccountInfoActivity", "User role: ${user.role}")
                    } else {
                        Toast.makeText(this@AccountInfoActivity, "Failed to load profile", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Log.e(TAG, "Error fetching user profile: ${t.message}")
                }
            })
    }

    private fun updateUI(user: User) {
        usernameView.text = user.username
        emailView.text = user.email ?: "Not provided"
        phoneView.text = user.phone ?: "Not provided"
        locationView.text = user.location ?: "No location"
        coinsBalanceView.text = "YenkasaCoins: ${user.coinsBalance ?: 0}"
        communityView.text = "Community: ${user.community?.name ?: "None"}"
        dateJoinedView.text = "Joined: ${formatDate(user.createdAt)}"

        if (user.verified) {
            iconVerified.visibility = View.VISIBLE
        } else {
            iconVerified.visibility = View.GONE
        }

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

    private fun loadUserPosts() {
        val token = TokenManager.getToken(this) ?: return
        ApiClient.apiService.getMyPosts("Bearer $token")
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    if (response.isSuccessful && response.body() != null) {
                        Log.d(TAG, "User profile response: ${response.body()}")
                        val mediaPosts = response.body()!!.filter { !it.mediaUrl.isNullOrBlank() }
                        userPostsList.clear()
                        userPostsList.addAll(mediaPosts)
                        postAdapter.notifyDataSetChanged()
                        postsCountView.text = "${mediaPosts.size}\nPosts"
                    }
                }
                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Log.e(TAG, "Posts load failed: ${t.message}")
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

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowFeedActivity::class.java)
        intent.putExtra("LIST_TYPE", type) // "followers" or "following"
        intent.putExtra("USER_ID", TokenManager.getUserId(this))
        startActivity(intent)
    }
}
