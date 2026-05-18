package xyz.yenkasa.app.ui

import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.PostApprovalAdapter
import xyz.yenkasa.app.model.PostApprovalItem
import xyz.yenkasa.app.model.PostApprovalResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UserPermissions
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class PostApprovalActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "PostApprovalActivity"
    }


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
        val role = TokenManager.getUserRole(this)
        val canApprove = UserPermissions.canApprove(role)
        Log.d(TAG, "Post approval permission check role=$role canApprove=$canApprove")

        if (!canApprove) {
            emptyText.text = getString(R.string.not_authorized_approve_posts)
            emptyText.visibility = View.VISIBLE
            return
        }

        // ✔ Adapter (REAL DATA will be sent later)
        adapter = PostApprovalAdapter(
            items = mutableListOf(),
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
                        Log.d(TAG, "Loaded pending approvals count=${pending.size}")

                        if (pending.isNotEmpty()) {
                            adapter.updateItems(pending)
                            recyclerView.visibility = View.VISIBLE
                        } else {
                            showEmpty(getString(R.string.no_pending_posts))
                        }
                    } else {
                        Log.w(TAG, "Failed to load pending approvals code=${response.code()} error=${response.errorBody()?.string()}")
                        showEmpty(getString(R.string.failed_to_load_pending_posts))
                    }
                }

                override fun onFailure(call: Call<PostApprovalResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    showEmpty(getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown_error)))
                }
            })

    }

    private fun approvePost(approvalId: String) {
        val token = TokenManager.getToken(this)

        ApiClient.apiService.approvePendingPost(approvalId, "Bearer $token")
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, R.string.post_approved, Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, R.string.approval_failed, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(
                        this@PostApprovalActivity,
                        getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun rejectPost(approvalId: String) {
        val token = TokenManager.getToken(this)

        ApiClient.apiService.rejectPendingPost(approvalId, "Bearer $token")
            .enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostApprovalActivity, R.string.post_rejected, Toast.LENGTH_SHORT).show()
                        loadPendingPosts()
                    } else {
                        Toast.makeText(this@PostApprovalActivity, R.string.rejection_failed, Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    Toast.makeText(
                        this@PostApprovalActivity,
                        getString(R.string.error_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun showEmpty(message: String) {
        recyclerView.visibility = View.GONE
        emptyText.text = message
        emptyText.visibility = View.VISIBLE
    }
}
