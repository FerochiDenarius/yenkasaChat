package com.example.yenkasachat.ui

import android.os.Bundle
import android.view.View
import android.widget.Button
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

class FollowListActivity : AppCompatActivity() {

    private lateinit var recyclerUsers: RecyclerView
    private lateinit var adapter: UserAdapter
    private val users = mutableListOf<User>()

    private lateinit var listType: String
    private lateinit var userId: String
    private var token: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_follow_list)

        recyclerUsers = findViewById(R.id.recyclerUsers)
        recyclerUsers.layoutManager = LinearLayoutManager(this)

        token = TokenManager.getToken(this)
        listType = intent.getStringExtra("LIST_TYPE") ?: "followers"
        userId = intent.getStringExtra("USER_ID") ?: TokenManager.getUserId(this) ?: ""

        adapter = UserAdapter(users) { user, view ->
            // Follow/Unfollow button click
            val btnFollow: Button = view.findViewById(R.id.btnFollow)
            toggleFollow(user, btnFollow)
        }
        recyclerUsers.adapter = adapter

        loadFollowList()
    }

    private fun loadFollowList() {
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
                    Toast.makeText(this@FollowListActivity, "Failed to load $listType", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<User>>, t: Throwable) {
                Toast.makeText(this@FollowListActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun toggleFollow(user: User, btnFollow: Button) {
        if (token.isNullOrEmpty()) return

        ApiClient.apiService.toggleFollow(user._id, "Bearer $token")
            .enqueue(object : Callback<Map<String, Any>> {
                override fun onResponse(call: Call<Map<String, Any>>, response: Response<Map<String, Any>>) {
                    if (response.isSuccessful) {
                        val isFollowing = response.body()?.get("message")?.toString()?.contains("Followed") == true
                        btnFollow.text = if (isFollowing) "Unfollow" else "Follow"
                        Toast.makeText(
                            this@FollowListActivity,
                            response.body()?.get("message")?.toString() ?: "Success",
                            Toast.LENGTH_SHORT
                        ).show()
                    } else {
                        Toast.makeText(this@FollowListActivity, "Action failed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Map<String, Any>>, t: Throwable) {
                    Toast.makeText(this@FollowListActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
