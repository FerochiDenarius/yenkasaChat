package xyz.yenkasa.app.ui

import android.app.AlertDialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.CommunityApprovalAdapter
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.GenericResponse
import xyz.yenkasa.app.model.MyCommunitiesResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunityApprovalActivity : AppCompatActivity() {
    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: View
    private lateinit var emptyView: TextView
    private lateinit var backButton: ImageButton
    private lateinit var searchInput: EditText
    private lateinit var filterButton: Button
    private lateinit var adapter: CommunityApprovalAdapter
    private var authToken: String? = null
    private var allCommunities: List<Community> = emptyList()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_approval_list)
        findViewById<TextView>(R.id.textApprovalTitle).text = "Community Approvals"
        findViewById<TextView>(R.id.textApprovalSubtitle).text = "Review and approve new community requests"

        authToken = TokenManager.getToken(this)?.let { "Bearer $it" }
        if (authToken.isNullOrBlank()) {
            Toast.makeText(this, "Login required", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        recyclerView = findViewById(R.id.recyclerViewApproval)
        progressBar = findViewById(R.id.progressBarApproval)
        emptyView = findViewById(R.id.textEmptyApproval)
        backButton = findViewById(R.id.buttonApprovalBack)
        searchInput = findViewById(R.id.inputSearch)
        filterButton = findViewById(R.id.btnFilter)
        emptyView.text = "No pending communities."

        adapter = CommunityApprovalAdapter(
            mutableListOf(),
            onApprove = { approveCommunity(it) },
            onReject = { promptReject(it) }
        )
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
        backButton.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }

        searchInput.hint = "Search communities..."
        filterButton.setOnClickListener {
            Toast.makeText(this, "Showing pending communities", Toast.LENGTH_SHORT).show()
        }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                filterCommunities(s?.toString().orEmpty())
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadPendingCommunities()
    }

    private fun loadPendingCommunities() {
        progressBar.visibility = View.VISIBLE
        ApiClient.apiService.getPendingCommunities(authToken!!)
            .enqueue(object : Callback<MyCommunitiesResponse> {
                override fun onResponse(
                    call: Call<MyCommunitiesResponse>,
                    response: Response<MyCommunitiesResponse>
                ) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful) {
                        allCommunities = response.body()?.communities.orEmpty()
                        filterCommunities(searchInput.text?.toString().orEmpty())
                    } else {
                        allCommunities = emptyList()
                        adapter.submit(emptyList())
                        emptyView.visibility = View.VISIBLE
                        emptyView.text = when (response.code()) {
                            403 -> "Your rank is not allowed to review communities. Admin, Moderator, Junior Developer, and Senior Developer can approve communities."
                            else -> parseErrorMessage(response, "Failed to load pending communities.")
                        }
                    }
                }

                override fun onFailure(call: Call<MyCommunitiesResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    emptyView.visibility = View.VISIBLE
                    emptyView.text = "Failed to load pending communities."
                }
            })
    }

    private fun filterCommunities(query: String) {
        val filtered = allCommunities.filter { community ->
            query.isBlank() ||
                (community.displayName?.contains(query, ignoreCase = true) == true) ||
                (community.name?.contains(query, ignoreCase = true) == true) ||
                (community.creator?.username?.contains(query, ignoreCase = true) == true)
        }
        adapter.submit(filtered)
        emptyView.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun approveCommunity(community: Community) {
        val id = community.id ?: return
        ApiClient.apiService.approveCommunity(authToken!!, id)
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(call: Call<GenericResponse>, response: Response<GenericResponse>) {
                    if (response.isSuccessful) {
                        allCommunities = allCommunities.filterNot { it.id == id }
                        adapter.removeCommunity(id)
                        filterCommunities(searchInput.text?.toString().orEmpty())
                        Toast.makeText(this@CommunityApprovalActivity, "Community approved", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(
                            this@CommunityApprovalActivity,
                            parseErrorMessage(response, "Failed to approve community"),
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(this@CommunityApprovalActivity, "Approval failed", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun promptReject(community: Community) {
        val input = EditText(this)
        input.hint = "Optional rejection reason"
        AlertDialog.Builder(this)
            .setTitle("Reject community")
            .setView(input)
            .setPositiveButton("Reject") { _, _ ->
                rejectCommunity(community, input.text?.toString().orEmpty())
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun rejectCommunity(community: Community, reason: String) {
        val id = community.id ?: return
        ApiClient.apiService.rejectCommunity(authToken!!, id, mapOf("reason" to reason))
            .enqueue(object : Callback<GenericResponse> {
                override fun onResponse(call: Call<GenericResponse>, response: Response<GenericResponse>) {
                    if (response.isSuccessful) {
                        allCommunities = allCommunities.filterNot { it.id == id }
                        adapter.removeCommunity(id)
                        filterCommunities(searchInput.text?.toString().orEmpty())
                        Toast.makeText(this@CommunityApprovalActivity, "Community rejected", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(
                            this@CommunityApprovalActivity,
                            parseErrorMessage(response, "Failed to reject community"),
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<GenericResponse>, t: Throwable) {
                    Toast.makeText(this@CommunityApprovalActivity, "Reject failed", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun parseErrorMessage(response: Response<*>, fallback: String): String {
        val raw = response.errorBody()?.string().orEmpty()
        if (raw.isBlank()) return fallback

        return runCatching {
            val json = JSONObject(raw)
            json.optString("message")
                .ifBlank { json.optString("error") }
                .ifBlank { fallback }
        }.getOrDefault(fallback)
    }
}
