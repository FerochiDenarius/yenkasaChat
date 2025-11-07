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

        // ✅ 1. Verify user role before proceeding
        val userRole = TokenManager.getUserRole(this)
        val hasApprovalPrivilege =
            userRole == "admin" || userRole == "moderator" || userRole == "developer"

        if (!hasApprovalPrivilege) {
            emptyText.text = "🚫 You are not authorized to approve posts."
            emptyText.visibility = View.VISIBLE
            recyclerView.visibility = View.GONE
            progressBar.visibility = View.GONE
            return
        }

        // ✅ 2. Initialize adapter
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

        // ✅ 3. Load pending posts
        loadPendingPosts()
    }

    // 🔹 Fetch all pending posts awaiting approval
    private fun loadPendingPosts() {
        progressBar.visibility = View.VISIBLE
        emptyText.visibility = View.GONE
        recyclerView.visibility = View.GONE

        Log.d("PostApproval", "🔄 Fetching pending posts...")

        ApiClient.apiService.getPendingPosts().enqueue(object : Callback<List<Post>> {
            override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                progressBar.visibility = View.GONE
                if (response.isSuccessful) {
                    val posts = response.body().orEmpty()
                    Log.d("PostApproval", "✅ Response success, count = ${posts.size}")

                    if (posts.isNotEmpty()) {
                        adapter.updatePosts(posts)
                        recyclerView.visibility = View.VISIBLE
                        emptyText.visibility = View.GONE
                    } else {
                        showEmptyMessage("No pending posts to review.")
                    }
                } else {
                    Log.e(
                        "PostApproval",
                        "❌ Response failed: ${response.code()} ${response.message()}"
                    )
                    showEmptyMessage("Failed to load posts. (${response.code()})")
                }
            }

            override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                progressBar.visibility = View.GONE
                Log.e("PostApproval", "🚨 Network failure: ${t.message}", t)
                showEmptyMessage("Network error: ${t.message}")
            }
        })
    }

    // 🔹 Approve post
    private fun approvePost(postId: String) {
        ApiClient.apiService.approvePost(postId).enqueue(object : Callback<Post> {
            override fun onResponse(call: Call<Post>, response: Response<Post>) {
                if (response.isSuccessful) {
                    Toast.makeText(this@PostApprovalActivity, "✅ Post approved!", Toast.LENGTH_SHORT).show()
                    loadPendingPosts()
                } else {
                    Toast.makeText(this@PostApprovalActivity, "❌ Approval failed.", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<Post>, t: Throwable) {
                Toast.makeText(this@PostApprovalActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // 🔹 Reject post
    private fun rejectPost(postId: String) {
        ApiClient.apiService.rejectPost(postId).enqueue(object : Callback<Post> {
            override fun onResponse(call: Call<Post>, response: Response<Post>) {
                if (response.isSuccessful) {
                    Toast.makeText(this@PostApprovalActivity, "🚫 Post rejected.", Toast.LENGTH_SHORT).show()
                    loadPendingPosts()
                } else {
                    Toast.makeText(this@PostApprovalActivity, "❌ Rejection failed.", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<Post>, t: Throwable) {
                Toast.makeText(this@PostApprovalActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // 🔹 Helper to show empty or error messages
    private fun showEmptyMessage(message: String) {
        recyclerView.visibility = View.GONE
        emptyText.text = message
        emptyText.visibility = View.VISIBLE
    }
}
