package com.example.yenkasachat.ui

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class FollowFeedActivity : AppCompatActivity() {

    private lateinit var recyclerFeed: RecyclerView
    private lateinit var adapter: PostAdapter
    private val posts = mutableListOf<Post>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_follow_feed)

        recyclerFeed = findViewById(R.id.recyclerFeed)
        adapter = PostAdapter(posts, this)

        recyclerFeed.layoutManager = LinearLayoutManager(this)
        recyclerFeed.adapter = adapter

        loadFollowingFeed()
    }

    private fun loadFollowingFeed() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.getFollowingFeed("Bearer $token")
            .enqueue(object : Callback<List<Post>> {
                override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                    if (response.isSuccessful) {
                        posts.clear()
                        response.body()?.let { posts.addAll(it) }
                        adapter.notifyDataSetChanged()
                    } else {
                        Toast.makeText(this@FollowFeedActivity, "Failed to load feed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                    Toast.makeText(this@FollowFeedActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
