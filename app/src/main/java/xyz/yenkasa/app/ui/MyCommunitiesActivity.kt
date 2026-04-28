package xyz.yenkasa.app.ui

import android.app.AlertDialog
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.MyCommunitiesAdapter
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.MyCommunitiesResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MyCommunitiesActivity : AppCompatActivity() {

    private enum class StatusFilter(val label: String) {
        ALL("All"),
        PENDING("Pending"),
        APPROVED("Approved"),
        REJECTED("Rejected")
    }

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView
    private lateinit var backButton: ImageButton
    private lateinit var titleView: TextView
    private lateinit var subtitleView: TextView
    private lateinit var searchInput: EditText
    private lateinit var filterButton: Button
    private lateinit var adapter: MyCommunitiesAdapter
    private var allCommunities: List<Community> = emptyList()
    private var currentFilter = StatusFilter.ALL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_status_list)
        title = "My Communities"

        backButton = findViewById(R.id.buttonStatusListBack)
        titleView = findViewById(R.id.textStatusListTitle)
        subtitleView = findViewById(R.id.textStatusListSubtitle)
        recyclerView = findViewById(R.id.recyclerViewStatusList)
        progressBar = findViewById(R.id.progressBarStatusList)
        emptyView = findViewById(R.id.textEmptyStatusList)
        searchInput = findViewById(R.id.inputStatusSearch)
        filterButton = findViewById(R.id.btnStatusFilter)

        titleView.text = "My Communities"
        subtitleView.text = "Track created communities and their approval status."
        emptyView.text = "No created communities yet."
        searchInput.hint = "Search communities..."
        filterButton.text = currentFilter.label

        adapter = MyCommunitiesAdapter(mutableListOf())
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter

        backButton.setOnClickListener {
            onBackPressedDispatcher.onBackPressed()
        }
        filterButton.setOnClickListener { showFilterDialog() }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                renderCommunities()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        loadMyCommunities()
    }

    override fun onResume() {
        super.onResume()
        loadMyCommunities()
    }

    private fun loadMyCommunities() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrBlank()) {
            Toast.makeText(this, "Login required", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        progressBar.visibility = View.VISIBLE
        ApiClient.apiService.getMyCommunities("Bearer $token")
            .enqueue(object : Callback<MyCommunitiesResponse> {
                override fun onResponse(
                    call: Call<MyCommunitiesResponse>,
                    response: Response<MyCommunitiesResponse>
                ) {
                    progressBar.visibility = View.GONE
                    allCommunities = response.body()?.communities.orEmpty()
                    renderCommunities()
                }

                override fun onFailure(call: Call<MyCommunitiesResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    emptyView.visibility = View.VISIBLE
                    emptyView.text = "Failed to load your communities."
                }
            })
    }

    private fun showFilterDialog() {
        val filters = StatusFilter.entries.toTypedArray()
        val currentIndex = filters.indexOf(currentFilter).coerceAtLeast(0)
        AlertDialog.Builder(this)
            .setTitle("Filter communities")
            .setSingleChoiceItems(filters.map { it.label }.toTypedArray(), currentIndex) { dialog, which ->
                currentFilter = filters[which]
                filterButton.text = currentFilter.label
                renderCommunities()
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun renderCommunities() {
        val query = searchInput.text?.toString().orEmpty().trim()
        val filtered = allCommunities.filter { community ->
            matchesFilter(community) && matchesQuery(community, query)
        }
        adapter.submit(filtered)
        emptyView.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        subtitleView.text = when (currentFilter) {
            StatusFilter.ALL -> "Showing ${filtered.size} communit${if (filtered.size == 1) "y" else "ies"} across all statuses."
            else -> "Showing ${filtered.size} ${currentFilter.label.lowercase()} communit${if (filtered.size == 1) "y" else "ies"}."
        }
    }

    private fun matchesFilter(community: Community): Boolean {
        val status = normalizedStatus(community)
        return currentFilter == StatusFilter.ALL || status == currentFilter.name.lowercase()
    }

    private fun matchesQuery(community: Community, query: String): Boolean {
        if (query.isBlank()) return true
        return community.displayName?.contains(query, ignoreCase = true) == true ||
            community.name?.contains(query, ignoreCase = true) == true ||
            community.creator?.username?.contains(query, ignoreCase = true) == true
    }

    private fun normalizedStatus(community: Community): String = when {
        !community.isActive -> "rejected"
        community.isApproved -> "approved"
        else -> "pending"
    }
}
