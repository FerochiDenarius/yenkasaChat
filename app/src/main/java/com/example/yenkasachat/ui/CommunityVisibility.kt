package com.example.yenkasachat.ui

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.CommunityVisibilityAdapter
import com.example.yenkasachat.model.ApiResponse
import com.example.yenkasachat.model.CommunityVisibilityModel
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CommunityVisibilityActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnSave: Button
    private lateinit var adapter: CommunityVisibilityAdapter

    private var token: String? = null


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_community_visibility)

        initAuth()
        initViews()
        initRecyclerView()

        fetchVisibilitySettings()

        btnSave.setOnClickListener { saveVisibilitySettings() }
    }


    // ----------------------------------------------------------
    // 🔵 Authentication (Matches FeedFragment style)
    // ----------------------------------------------------------
    private fun initAuth() {
        token = TokenManager.getToken(this)

        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            finish()
        }
    }


    // ----------------------------------------------------------
    // 🔵 Initialize Views
    // ----------------------------------------------------------
    private fun initViews() {
        recyclerView = findViewById(R.id.rvCommunityVisibility)
        progressBar = findViewById(R.id.progressBar)
        btnSave = findViewById(R.id.btnSaveVisibility)
    }


    // ----------------------------------------------------------
    // 🔵 Initialize RecyclerView
    // ----------------------------------------------------------
    private fun initRecyclerView() {
        adapter = CommunityVisibilityAdapter(mutableListOf())
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = adapter
    }


    // ----------------------------------------------------------
    // 🔵 Fetch Visibility (Like FeedFragment load steps)
    // ----------------------------------------------------------
    private fun fetchVisibilitySettings() {
        progressBar.visibility = View.VISIBLE

        ApiClient.apiService.getCommunityVisibility("Bearer $token")
            .enqueue(object : Callback<List<CommunityVisibilityModel>> {

                override fun onResponse(
                    call: Call<List<CommunityVisibilityModel>>,
                    response: Response<List<CommunityVisibilityModel>>
                ) {
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        adapter.update(response.body()!!)
                    } else {
                        Toast.makeText(
                            this@CommunityVisibilityActivity,
                            "Failed to load visibility settings",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<CommunityVisibilityModel>>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@CommunityVisibilityActivity,
                        "Network error",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }


    // ----------------------------------------------------------
    // 🔵 Save Visibility (Exactly like your save in other screens)
    // ----------------------------------------------------------
    private fun saveVisibilitySettings() {
        val settingsList = adapter.collectedVisibility()

        progressBar.visibility = View.VISIBLE
        btnSave.isEnabled = false

        ApiClient.apiService.saveCommunityVisibility("Bearer $token", settingsList)
            .enqueue(object : Callback<ApiResponse> {

                override fun onResponse(
                    call: Call<ApiResponse>,
                    response: Response<ApiResponse>
                ) {
                    progressBar.visibility = View.GONE
                    btnSave.isEnabled = true

                    if (response.isSuccessful) {
                        Toast.makeText(
                            this@CommunityVisibilityActivity,
                            "Visibility updated successfully",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(
                            this@CommunityVisibilityActivity,
                            "Failed to save changes",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    btnSave.isEnabled = true

                    Toast.makeText(
                        this@CommunityVisibilityActivity,
                        "Network error",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
