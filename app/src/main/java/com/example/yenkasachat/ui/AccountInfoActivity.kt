package com.example.yenkasachat.ui

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
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ProfilePostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class AccountInfoActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextView
    private lateinit var emailView: TextView
    private lateinit var phoneView: TextView
    private lateinit var locationView: TextView
    private lateinit var followersCountView: TextView
    private lateinit var followingCountView: TextView
    private lateinit var postsCountView: TextView
    private lateinit var recyclerUserPosts: RecyclerView
    private lateinit var btnEditProfile: Button

    private lateinit var profilePostAdapter: ProfilePostAdapter
    private val userPostsList = mutableListOf<Post>()

    private val TAG = "AccountInfoActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_account_info)

        bindViews()
        setupRecyclerView()
        setupListeners()

        // show cached values first
        loadProfileFromCache()

        // then refresh from backend
        fetchUserProfile()
        loadUserPosts()
    }

    private fun bindViews() {
        imageProfile = findViewById(R.id.imageProfile)
        usernameView = findViewById(R.id.textUsername)
        emailView = findViewById(R.id.textEmail)
        phoneView = findViewById(R.id.textPhone)
        locationView = findViewById(R.id.textLocation)
        followersCountView = findViewById(R.id.textFollowersCount)
        followingCountView = findViewById(R.id.textFollowingCount)
        postsCountView = findViewById(R.id.textPostsCount)
        recyclerUserPosts = findViewById(R.id.recyclerUserPosts)
        btnEditProfile = findViewById(R.id.btnEditSave)
    }

    private fun setupRecyclerView() {
        profilePostAdapter = ProfilePostAdapter(userPostsList)
        recyclerUserPosts.apply {
            layoutManager = GridLayoutManager(this@AccountInfoActivity, 3)
            adapter = profilePostAdapter
            isNestedScrollingEnabled = false
        }
    }

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

        val profileUrl = TokenManager.getProfilePicUrl(this)
        Glide.with(this)
            .load(profileUrl ?: R.drawable.default_avatar)
            .apply(RequestOptions.circleCropTransform())
            .into(imageProfile)
    }

    private fun fetchUserProfile() {
        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful && response.body() != null) {
                        val user = response.body()!!
                        updateUI(user)

                        // Save for future use
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
                    } else {
                        Log.e(TAG, "Failed to fetch user profile: ${response.code()}")
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
                        userPostsList.clear()
                        userPostsList.addAll(response.body()!!)
                        profilePostAdapter.notifyDataSetChanged()
                        postsCountView.text = "${userPostsList.size}\nPosts"
                    } else {
                        Log.e(TAG, "Failed to load posts: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Log.e(TAG, "Posts load failed: ${t.message}")
                }
            })
    }

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowListActivity::class.java)
        intent.putExtra("TYPE", type)
        intent.putExtra("USER_ID", TokenManager.getUserId(this))
        startActivity(intent)
    }
}
