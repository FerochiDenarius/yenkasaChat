package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.CommunityVisibilityAdapter
import com.example.yenkasachat.model.CommunityVisibilityModel
import com.example.yenkasachat.network.ApiClient
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response


class CommunityVisibilityActivity : AppCompatActivity() {

    private lateinit var adapter: CommunityVisibilityAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_community_visibility)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvCommunityVisibility)
        rv.layoutManager = LinearLayoutManager(this)
        adapter = CommunityVisibilityAdapter(mutableListOf())
        rv.adapter = adapter

        loadVisibility()
    }

    private fun loadVisibility() {

        ApiClient.apiService.getCommunityVisibility()
            .enqueue(object : Callback<List<CommunityVisibilityModel>> {

                override fun onResponse(
                    call: Call<List<CommunityVisibilityModel>>,
                    response: Response<List<CommunityVisibilityModel>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        adapter.update(response.body()!!)
                    }
                }

                override fun onFailure(
                    call: Call<List<CommunityVisibilityModel>>,
                    t: Throwable
                ) {
                    Toast.makeText(
                        this@CommunityVisibilityActivity,
                        "Failed to load",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
