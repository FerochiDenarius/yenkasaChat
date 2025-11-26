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
import com.example.yenkasachat.adapter.PostApprovalAdapter
import com.example.yenkasachat.model.PostApprovalItem
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.model.PostApprovalResponse
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

        // ✔ Permission Check
        val role = TokenManager.getUserRole(this).lowercase()
        val allowed = listOf(
            "admin", "moderator",
            "senior_developer", "junior_developer"
        )

        if (role !in allowed) {
            emptyText.text = "🚫 You are not authorized to approve posts."
            emptyText.visibility = View.VISIBLE
            return
        }

        // ✔ Adapter (REAL DATA will be sent later)
        adapter = PostApprovalAdapter(
            posts = mutableListOf(),
            context = this,
            approveCallback = ::approvePost,
            rejectCallback = ::rejectPost
        )

        recyclerView.adapter = adapter

        // Load posts
        loadPendingPosts()


    }

    private fun loadPendingPosts() {
        progressBar.visibility = View.VISIBLE
        emptyText.visibility = View.GONE
        recyclerView.visibility = View.GONE

        val token = TokenManager.getToken(this)

        ApiClient.apiService.getPendingApprovalPosts("Bearer $token")
            .enqueue(object : Callback<PostApprovalResponse> {
                override fun onResponse(
                    call: Call<PostApprovalResponse>,
                    response: Response<PostApprovalResponse>
                ) {
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        val pending: List<PostApprovalItem> = response.body()!!.pending

                        if (pending.isNotEmpty()) {
                            val posts = pending.map { it.post }
                            adapter.updatePosts(posts)
                            recyclerView.visibility = View.VISIBLE
                        } else {
                            showEmpty("No pending posts.")
                        }
                    } else {
                        showEmpty("Failed to load pending posts.")
                    }
                }

                override fun onFailure(call: Call<PostApprovalResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    showEmpty("Network error: ${t.message}")
                }
            })

    }

    private fun approvePost(approvalId: String) {
        val token = TokenManager.getToken(this)

        ApiClient.apiService.approvePendingPost(approvalId, "Bearer $token")
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, "Post Approved!", Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, "Approval failed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(this@PostApprovalActivity, t.message, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun rejectPost(approvalId: String) {
        val token = TokenManager.getToken(this)

        ApiClient.apiService.rejectPendingPost(approvalId, "Bearer $token")
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, "Post Rejected.", Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, "Rejection failed.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(this@PostApprovalActivity, t.message, Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun showEmpty(message: String) {
        recyclerView.visibility = View.GONE
        emptyText.text = message
        emptyText.visibility = View.VISIBLE
    }
}
