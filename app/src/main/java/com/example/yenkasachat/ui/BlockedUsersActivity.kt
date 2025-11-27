package com.example.yenkasachat.ui

import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.BlockedUsersAdapter
import com.example.yenkasachat.model.BlockedUserModel
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class BlockedUsersActivity : AppCompatActivity() {

    private lateinit var adapter: BlockedUsersAdapter
    private lateinit var emptyText: TextView
    private lateinit var progress: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocked_users)

        val rv = findViewById<androidx.recyclerview.widget.RecyclerView>(R.id.rvBlockedUsers)
        emptyText = findViewById(R.id.txtEmpty)
        progress = findViewById(R.id.progressBar)

        rv.layoutManager = LinearLayoutManager(this)
        adapter = BlockedUsersAdapter(mutableListOf())
        rv.adapter = adapter

        loadBlockedUsers()
    }

    private fun loadBlockedUsers() {
        progress.visibility = View.VISIBLE
        emptyText.visibility = View.GONE

        ApiClient.apiService.getBlockedUsers()
            .enqueue(object : Callback<List<BlockedUserModel>> {

                override fun onResponse(
                    call: Call<List<BlockedUserModel>>,
                    response: Response<List<BlockedUserModel>>
                ) {
                    progress.visibility = View.GONE

                    if (!response.isSuccessful || response.body() == null) {
                        emptyText.visibility = View.VISIBLE
                        emptyText.text = "Failed to load blocked users"
                        return
                    }

                    val list = response.body()!!
                    if (list.isEmpty()) {
                        emptyText.visibility = View.VISIBLE
                        emptyText.text = "No blocked users"
                    } else {
                        emptyText.visibility = View.GONE
                    }

                    adapter.update(list)
                }

                override fun onFailure(
                    call: Call<List<BlockedUserModel>>,
                    t: Throwable
                ) {
                    progress.visibility = View.GONE
                    emptyText.visibility = View.VISIBLE
                    emptyText.text = "Connection error"

                    Toast.makeText(
                        this@BlockedUsersActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
