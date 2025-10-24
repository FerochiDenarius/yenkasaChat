package com.example.yenkasachat.ui

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.UserAdapter
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.net.HttpURLConnection
import java.net.URL

class FollowFeedActivity : AppCompatActivity() {

    private lateinit var recyclerUsers: RecyclerView
    private lateinit var adapter: UserAdapter
    private val users = mutableListOf<User>()
    private lateinit var listType: String
    private lateinit var userId: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_follow_feed)

        recyclerUsers = findViewById(R.id.recyclerUsers)
        recyclerUsers.layoutManager = LinearLayoutManager(this)

        adapter = UserAdapter(users) { user, view ->
            val token = TokenManager.getToken(this)
            val currentUserId = TokenManager.getUserId(this)
            if (token.isNullOrEmpty() || currentUserId == null) {
                Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
                return@UserAdapter
            }

            // 🔹 Follow API request
            ApiClient.apiService.followUser("Bearer $token", user._id)
                .enqueue(object : Callback<Void> {
                    override fun onResponse(call: Call<Void>, response: Response<Void>) {
                        if (response.isSuccessful) {
                            Toast.makeText(
                                this@FollowFeedActivity,
                                "You followed ${user.username}",
                                Toast.LENGTH_SHORT
                            ).show()

                            // ✅ Send OneSignal follow notification
                            sendFollowNotification(currentUserId, user._id, user.username)
                        } else {
                            Toast.makeText(
                                this@FollowFeedActivity,
                                "Failed to follow ${user.username}",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    }

                    override fun onFailure(call: Call<Void>, t: Throwable) {
                        Toast.makeText(
                            this@FollowFeedActivity,
                            "Network error: ${t.message}",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                })
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

    // ✅ MOVE THIS OUTSIDE loadFollowList()
    private fun sendFollowNotification(followerId: String, followedId: String, followedUsername: String) {
        val jsonBody = JSONObject().apply {
            put("app_id", "165df9e6-a0ea-4a37-a40a-110af7e28ad2") // Your OneSignal App ID
            put("include_external_user_ids", JSONArray().put(followedId)) // Target specific user
            put("headings", JSONObject().put("en", "New Follower"))
            put("contents", JSONObject().put("en", "$followedUsername started following you"))
            put("data", JSONObject().put("type", "follow").put("from_user", followerId))
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("https://onesignal.com/api/v1/notifications")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                conn.setRequestProperty(
                    "Authorization",
                    "Basic YOUR_REST_API_KEY" // 🔑 Replace with your OneSignal REST API key
                )
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }

                val responseCode = conn.responseCode
                Log.d("FollowFeedActivity", "OneSignal follow response: $responseCode")
            } catch (e: Exception) {
                Log.e("FollowFeedActivity", "Follow notification failed: ${e.message}")
            }
        }
    }
}
