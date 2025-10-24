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
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class UserProfileActivity : AppCompatActivity() {

    private lateinit var imageProfile: ImageView
    private lateinit var usernameView: TextView
    private lateinit var followersCountView: TextView
    private lateinit var followingCountView: TextView
    private lateinit var postsCountView: TextView
    private lateinit var recyclerUserPosts: RecyclerView
    private lateinit var btnFollow: Button
    private lateinit var btnMessage: Button

    private lateinit var postAdapter: PostAdapter
    private val userPostsList = mutableListOf<Post>()

    private var userId: String? = null
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
        loadUserPosts()
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
    }

    private fun setupRecyclerView() {
        postAdapter = PostAdapter(userPostsList)
        recyclerUserPosts.apply {
            layoutManager = GridLayoutManager(this@UserProfileActivity, 3)
            adapter = postAdapter
            isNestedScrollingEnabled = false
        }
    }

    private fun setupListeners() {
        imageProfile.setOnClickListener {
            val intent = Intent(this, ProfileImagePreviewActivity::class.java)
            intent.putExtra("IMAGE_URL", imageProfile.tag as? String ?: "")
            startActivity(intent)
        }

        btnFollow.setOnClickListener { followUser() }

        btnMessage.setOnClickListener {
            val intent = Intent(this, ChatActivity::class.java)
            intent.putExtra("RECIPIENT_ID", userId)
            startActivity(intent)
        }

        followersCountView.setOnClickListener { openFollowList("followers") }
        followingCountView.setOnClickListener { openFollowList("following") }
    }

    private fun fetchUserProfile() {
        val token = TokenManager.getToken(this) ?: return
        ApiClient.apiService.getUserById("Bearer $token", userId!!)
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful && response.body() != null) {
                        val user = response.body()!!
                        updateUI(user)
                    } else {
                        Toast.makeText(this@UserProfileActivity, "Failed to load profile", Toast.LENGTH_SHORT).show()
                        Log.e(TAG, "Error: ${response.code()} ${response.message()}")
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    Toast.makeText(this@UserProfileActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun updateUI(user: User) {
        usernameView.text = user.username
        followersCountView.text = "${user.followers?.size ?: 0}\nFollowers"
        followingCountView.text = "${user.following?.size ?: 0}\nFollowing"

        Glide.with(this)
            .load(user.profileImage ?: R.drawable.default_avatar)
            .apply(RequestOptions.circleCropTransform())
            .into(imageProfile)

        imageProfile.tag = user.profileImage
    }

    private fun loadUserPosts() {
        val token = TokenManager.getToken(this) ?: return
        ApiClient.apiService.getPostsByUser("Bearer $token", userId!!)
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    if (response.isSuccessful && response.body() != null) {
                        // Keep only posts with media
                        val mediaPosts = response.body()!!.filter { !it.mediaUrl.isNullOrBlank() } // adjust field name

                        userPostsList.clear()
                        userPostsList.addAll(mediaPosts)
                        postAdapter.notifyDataSetChanged()
                        postsCountView.text = "${mediaPosts.size}\nPosts"
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Log.e(TAG, "Error loading posts: ${t.message}")
                }
            })
    }

    private fun followUser() {
        val token = TokenManager.getToken(this) ?: return
        if (userId.isNullOrEmpty()) return

        ApiClient.apiService.followUser("Bearer $token", userId!!)
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@UserProfileActivity, "Followed ${usernameView.text}", Toast.LENGTH_SHORT).show()
                        fetchUserProfile()
                    } else {
                        Toast.makeText(this@UserProfileActivity, "Failed to follow user", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(this@UserProfileActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun openFollowList(type: String) {
        val intent = Intent(this, FollowListActivity::class.java)
        intent.putExtra("TYPE", type)
        intent.putExtra("USER_ID", userId)
        startActivity(intent)
    }
}
