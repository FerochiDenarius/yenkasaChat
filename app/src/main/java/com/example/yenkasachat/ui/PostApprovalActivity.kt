package com.example.yenkasachat.ui

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.adapter.PostApprovalAdapter
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class PostApprovalActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyText: TextView
    private lateinit var adapter: PostApprovalAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_approval)

        recyclerView = findViewById(R.id.recyclerViewPendingPosts)
        progressBar = findViewById(R.id.progressBarApproval)
        emptyText = findViewById(R.id.textViewEmpty)

        recyclerView.layoutManager = LinearLayoutManager(this)

        // ✅ 1. Check if current user is admin (TokenManager should store this after login)
        val isAdmin = TokenManager.isVerified(this) && TokenManager.getUserId(this) == "ADMIN_USER_ID" // Replace with real admin flag

        if (!isAdmin) {
            emptyText.text = "You are not authorized to approve posts."
            emptyText.visibility = View.VISIBLE
            return
        }

        // ✅ 2. Initialize adapter with callbacks
        adapter = PostApprovalAdapter(
            posts = mutableListOf(),
            context = this,
            approveCallback = ::approvePost,
            rejectCallback = ::rejectPost,
            approvedPosts = 0,
            followers = 0,
            totalComments = 0
        )

        recyclerView.adapter = adapter
        loadPendingPosts()
    }

    private fun loadPendingPosts() {
        progressBar.visibility = View.VISIBLE
        emptyText.visibility = View.GONE

        ApiClient.apiService.getPendingPosts()
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful && !response.body().isNullOrEmpty()) {
                        val posts = response.body()!!
                        adapter.updatePosts(posts.toMutableList())
                    } else {
                        emptyText.text = "No pending posts to review."
                        emptyText.visibility = View.VISIBLE
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    emptyText.text = "Failed to load posts: ${t.message}"
                    emptyText.visibility = View.VISIBLE
                    Log.e("PostApproval", "Error loading pending posts", t)
                }
            })
    }

    private fun approvePost(postId: String) {
        ApiClient.apiService.approvePost(postId)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, "Post approved!", Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, "Approval failed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    Toast.makeText(this@PostApprovalActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun rejectPost(postId: String) {
        ApiClient.apiService.rejectPost(postId)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, "Post rejected.", Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, "Rejection failed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    Toast.makeText(this@PostApprovalActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
