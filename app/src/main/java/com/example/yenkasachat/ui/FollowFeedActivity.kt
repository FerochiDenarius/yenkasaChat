package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.UserAdapter
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FollowFeedActivity : AppCompatActivity() {

    private lateinit var recyclerUsers: RecyclerView
    private lateinit var adapter: UserAdapter
    private val users = mutableListOf<User>()
    private lateinit var listType: String
    private lateinit var userId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Use a dedicated layout for feed
        setContentView(R.layout.activity_follow_feed)

        recyclerUsers = findViewById(R.id.recyclerUsers)
        recyclerUsers.layoutManager = LinearLayoutManager(this)

        adapter = UserAdapter(users) { user, view ->
            // Handle user click if needed
        }
        recyclerUsers.adapter = adapter

        listType = intent.getStringExtra("LIST_TYPE") ?: "followers"
        userId = intent.getStringExtra("USER_ID") ?: TokenManager.getUserId(this) ?: ""

        loadFollowList()
    }

    private fun loadFollowList() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) return

        val call = when (listType) {
            "followers" -> ApiClient.apiService.getFollowers(userId, "Bearer $token")
            else -> ApiClient.apiService.getFollowing(userId, "Bearer $token")
        }

        call.enqueue(object : Callback<List<User>> {
            override fun onResponse(call: Call<List<User>>, response: Response<List<User>>) {
                if (response.isSuccessful) {
                    users.clear()
                    response.body()?.let { users.addAll(it) }
                    adapter.notifyDataSetChanged()
                } else {
                    Toast.makeText(
                        this@FollowFeedActivity,
                        "Failed to load $listType",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<List<User>>, t: Throwable) {
                Toast.makeText(
                    this@FollowFeedActivity,
                    "Network error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }
}
