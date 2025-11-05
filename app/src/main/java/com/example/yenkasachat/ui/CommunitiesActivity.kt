package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.util.Log
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.CommunityAdapter
import com.example.yenkasachat.model.Community
import com.example.yenkasachat.model.JoinCommunityResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.widget.Button


class CommunitiesActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var searchView: SearchView
    private lateinit var fabCreateCommunity: FloatingActionButton
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyView: TextView

    private val communities = mutableListOf<Community>()
    private lateinit var adapter: CommunityAdapter
    private var token: String? = null


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activities_community)

        Log.d("CommunitiesActivity", "onCreate called — activity started")

        val token = TokenManager.getToken(this)
        Log.d("CommunitiesActivity", "Retrieved token from TokenManager: $token")

        if (token == null) {
            Toast.makeText(this, "Please log in", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        initViews()
        setupRecyclerView()
        setupSearch()
        loadCommunities()
        setupCreateCommunityButtons()

        // ✅ Connect adapter’s "View" button click
        adapter.onCommunitySelected = { community ->
            Log.d("CommunitiesActivity", "Community selected: ${community.displayName}")

            // Example action: open FeedActivity for this community
            val intent = Intent(this, FeedFragment::class.java)
            intent.putExtra("communityId", community.id)
            intent.putExtra("communityName", community.displayName)
            startActivity(intent)
        }

        fabCreateCommunity.setOnClickListener {
            val isVerified = TokenManager.isVerified(this)
            if (isVerified) {
                startActivity(Intent(this, CreateCommunityActivity::class.java))
            } else {
                Toast.makeText(
                    this,
                    "You must be verified to create a community",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewCommunities)
        searchView = findViewById(R.id.searchViewCommunities)
        fabCreateCommunity = findViewById(R.id.fabCreateCommunity)
        progressBar = findViewById(R.id.progressBarCommunities)
        emptyView = findViewById(R.id.textEmptyCommunities)
    }

    private fun setupRecyclerView() {
        adapter = CommunityAdapter(communities) { community ->
            // ✅ Directly open feed activity here
            val intent = Intent(this, FeedFragment::class.java)
            intent.putExtra("communityId", community.id)
            intent.putExtra("communityName", community.displayName)
            startActivity(intent)
        }
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }

    private fun setupSearch() {
        searchView.setOnQueryTextListener(object : SearchView.OnQueryTextListener {
            override fun onQueryTextSubmit(query: String?): Boolean {
                query?.let { searchCommunities(it) }
                return true
            }

            override fun onQueryTextChange(newText: String?): Boolean {
                if (newText.isNullOrEmpty()) {
                    loadCommunities()
                }
                return true
            }
        })
    }

    private fun loadCommunities() {
        showLoading(true)
        ApiClient.apiService.getCommunities("Bearer $token")
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(
                    call: Call<List<Community>>,
                    response: Response<List<Community>>
                ) {
                    showLoading(false)
                    if (response.isSuccessful && response.body() != null) {
                        communities.clear()
                        communities.addAll(response.body()!!)
                        adapter.notifyDataSetChanged()
                        emptyView.visibility = if (communities.isEmpty()) View.VISIBLE else View.GONE
                    } else {
                        Toast.makeText(
                            this@CommunitiesActivity,
                            "Failed to load communities",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                    showLoading(false)
                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun searchCommunities(query: String) {
        showLoading(true)

        ApiClient.apiService.getCommunities(
            token = "Bearer $token",
            search = query
        ).enqueue(object : Callback<List<Community>> {
            override fun onResponse(
                call: Call<List<Community>>,
                response: Response<List<Community>>
            ) {
                showLoading(false)

                if (response.isSuccessful && response.body() != null) {
                    communities.clear()
                    communities.addAll(response.body()!!)
                    adapter.notifyDataSetChanged()

                    if (communities.isEmpty()) {
                        emptyView.text = "No communities found for \"$query\""
                        emptyView.visibility = View.VISIBLE
                        recyclerView.visibility = View.GONE
                    } else {
                        emptyView.visibility = View.GONE
                        recyclerView.visibility = View.VISIBLE
                    }
                } else {
                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Failed to search communities (${response.code()})",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                showLoading(false)
                Toast.makeText(
                    this@CommunitiesActivity,
                    "Search error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    private fun showCommunityDialog(community: Community) {
        val dialog = android.app.AlertDialog.Builder(this)
            .setTitle(community.displayName)
            .setMessage(
                "${community.description}\n\n" +
                        "📍 ${community.location ?: "Interest-based"}\n" +
                        "👥 ${community.memberCount} members\n" +
                        "📝 ${community.postCount} posts"
            )
            .setPositiveButton("Join") { _, _ ->
                joinCommunity(community)
            }
            .setNegativeButton("Cancel", null)
            .create()

        dialog.show()
    }

    private fun joinCommunity(community: Community) {
        progressBar.visibility = View.VISIBLE

        // ✅ Safely handle nullable ID
        val communityId = community.id ?: return run {
            progressBar.visibility = View.GONE
            Toast.makeText(this, "Invalid community ID", Toast.LENGTH_SHORT).show()
        }

        ApiClient.apiService.joinCommunity("Bearer $token", communityId)
            .enqueue(object : Callback<JoinCommunityResponse> {
                override fun onResponse(
                    call: Call<JoinCommunityResponse>,
                    response: Response<JoinCommunityResponse>
                ) {
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body()?.success == true) {
                        // ✅ Use safe display name
                        val displayName = community.displayName ?: "Community"

                        Toast.makeText(
                            this@CommunitiesActivity,
                            "Joined $displayName!",
                            Toast.LENGTH_SHORT
                        ).show()

                        // ✅ Save joined community locally
                        getSharedPreferences("auth", Context.MODE_PRIVATE).edit()
                            .putString("communityId", communityId)
                            .putString("communityName", displayName)
                            .apply()

                        // 🚫 You can’t start a Fragment using Intent
                        // ✅ Correct: open FeedActivity (or MainActivity) instead
                        val intent = Intent(this@CommunitiesActivity, MainActivity::class.java)
                        intent.putExtra("openFragment", "feed")
                        startActivity(intent)
                        finish()

                    } else {
                        Toast.makeText(
                            this@CommunitiesActivity,
                            response.body()?.message ?: "Failed to join",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<JoinCommunityResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@CommunitiesActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
    private fun setupCreateCommunityButtons() {
        val userRole = TokenManager.getUserRole(this)
        val isVerified = TokenManager.isVerified(this)

        // ✅ Only these roles can create or edit communities
        val canManageCommunity = userRole == "admin" || userRole == "moderator" || userRole == "developer"

        Log.d("CommunitiesActivity", "User role=$userRole, verified=$isVerified, canManageCommunity=$canManageCommunity")

        val btnCreateCommunity = findViewById<Button>(R.id.btnCreateCommunity)

        val launchCreateCommunity = {
            if (canManageCommunity && isVerified) {
                startActivity(Intent(this, CreateCommunityActivity::class.java))
            } else {
                val message = when {
                    !isVerified -> "You must be verified to create a community"
                    else -> "Only admins, moderators, or developers can create communities"
                }
                Toast.makeText(this, message, Toast.LENGTH_LONG).show()
            }
        }

        // Attach listeners
        btnCreateCommunity.setOnClickListener { launchCreateCommunity() }
        fabCreateCommunity.setOnClickListener { launchCreateCommunity() }
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        recyclerView.visibility = if (show) View.GONE else View.VISIBLE
    }
}
