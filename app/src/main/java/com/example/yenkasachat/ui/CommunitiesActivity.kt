package com.example.yenkasachat.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
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

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", null)

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

        fabCreateCommunity.setOnClickListener {
            val isVerified = prefs.getBoolean("verified", false)
            if (isVerified) {
                // Directly launch CreateCommunityActivity
                val intent = Intent(this, CreateCommunityActivity::class.java)
                startActivity(intent)
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
            showCommunityDialog(community)
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

        ApiClient.apiService.getCommunities()
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

        ApiClient.apiService.getCommunities(search = query)
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

                        if (communities.isEmpty()) {
                            emptyView.text = "No communities found for '$query'"
                            emptyView.visibility = View.VISIBLE
                        } else {
                            emptyView.visibility = View.GONE
                        }
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

        ApiClient.apiService.joinCommunity("Bearer $token", community.id)
            .enqueue(object : Callback<JoinCommunityResponse> {
                override fun onResponse(
                    call: Call<JoinCommunityResponse>,
                    response: Response<JoinCommunityResponse>
                ) {
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body()?.success == true) {
                        Toast.makeText(
                            this@CommunitiesActivity,
                            "Joined ${community.displayName}!",
                            Toast.LENGTH_SHORT
                        ).show()

                        // Save joined community locally
                        getSharedPreferences("auth", Context.MODE_PRIVATE).edit()
                            .putString("communityId", community.id)
                            .putString("communityName", community.displayName)
                            .apply()

                        startActivity(Intent(this@CommunitiesActivity, FeedActivity::class.java))
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
        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)

        // Top "Create" button
        val btnCreateCommunity = findViewById<Button>(R.id.btnCreateCommunity)
        btnCreateCommunity.setOnClickListener {
            val isVerified = prefs.getBoolean("verified", false)
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

        // Floating action button
        fabCreateCommunity.setOnClickListener {
            val isVerified = prefs.getBoolean("verified", false)
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

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        recyclerView.visibility = if (show) View.GONE else View.VISIBLE
    }
}
