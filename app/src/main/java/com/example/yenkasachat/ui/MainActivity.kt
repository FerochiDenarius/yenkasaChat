package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.Menu
import android.view.MenuItem
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.PostAdapter
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.android.material.floatingactionbutton.FloatingActionButton
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewPosts: RecyclerView
    private lateinit var postAdapter: PostAdapter
    private val posts = mutableListOf<Post>()
    private lateinit var userId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // ✅ Setup Toolbar so the menu appears
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.title = "Yenkasa Feed"

        // ✅ Validate user authentication
        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }
        userId = retrievedUserId

        // ✅ Setup RecyclerView
        recyclerViewPosts = findViewById(R.id.recyclerViewPosts)
        recyclerViewPosts.layoutManager = LinearLayoutManager(this)
        postAdapter = PostAdapter(posts)
        recyclerViewPosts.adapter = postAdapter

        // ✅ Floating action button to create new post
        findViewById<FloatingActionButton>(R.id.btnAddPost).setOnClickListener {
            startActivity(Intent(this, PostActivity::class.java))
        }

        fetchPosts()
    }

    override fun onResume() {
        super.onResume()
        fetchPosts() // Refresh feed when returning from PostActivity
    }

    // ✅ Fetch posts from backend
    private fun fetchPosts() {
        ApiClient.apiService.getAllPosts().enqueue(object : Callback<List<Post>> {
            override fun onResponse(call: Call<List<Post>>, response: Response<List<Post>>) {
                if (response.isSuccessful && response.body() != null) {
                    posts.clear()
                    posts.addAll(response.body()!!)
                    postAdapter.notifyDataSetChanged()
                    Log.d("MainActivity", "Fetched ${posts.size} posts successfully.")
                } else {
                    val errorMsg = parseError(response)
                    Log.e("MainActivity", "Failed to load posts: $errorMsg")
                    Toast.makeText(this@MainActivity, "Failed to load posts", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<Post>>, t: Throwable) {
                Log.e("MainActivity", "Network error fetching posts: ${t.message}")
                Toast.makeText(this@MainActivity, "Network error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.let { errorJson ->
                if (errorJson.length > 200) "${errorJson.substring(0, 200)}..." else errorJson
            } ?: "Error: ${response.code()} ${response.message()}"
        } catch (e: IOException) {
            "Error parsing error: ${e.message}"
        }
    }

    // ✅ Inflate your existing main_menu.xml
    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.main_menu, menu)
        return true
    }

    // ✅ Handle menu item navigation
    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        return when (item.itemId) {
            R.id.action_contacts -> {
                startActivity(Intent(this, ContactsActivity::class.java))
                true
            }
            R.id.action_chat_rooms -> {
                startActivity(Intent(this, ChatRoomsActivity::class.java))
                true
            }
            R.id.action_account -> {
                startActivity(Intent(this, AccountInfoActivity::class.java))
                true
            }
            R.id.action_verify_account -> {
                Toast.makeText(this, "Verification coming soon!", Toast.LENGTH_SHORT).show()
                true
            }
            R.id.action_settings -> {
                Toast.makeText(this, "Settings coming soon!", Toast.LENGTH_SHORT).show()
                true
            }
            R.id.action_logout -> {
                TokenManager.clearAll(this)
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
                true
            }
            else -> super.onOptionsItemSelected(item)
        }
    }
}
