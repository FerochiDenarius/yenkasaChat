package xyz.yenkasa.app.ui

import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.UserAdapter
import xyz.yenkasa.app.model.FollowListResponse
import xyz.yenkasa.app.model.FollowResponse
import xyz.yenkasa.app.model.User
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
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
    private lateinit var btnFollowers: Button
    private lateinit var btnFollowing: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_follow_feed)

        recyclerUsers = findViewById(R.id.recyclerUsers)
        btnFollowers = findViewById(R.id.btnFollowers)
        btnFollowing = findViewById(R.id.btnFollowing)

        recyclerUsers.layoutManager = LinearLayoutManager(this)

        // ✅ Make sure UserAdapter’s callback actually sends (user, isFollowing: Boolean)
        adapter = UserAdapter(
            users,
            onFollowClick = { user, isFollowing ->
                handleFollowAction(user, isFollowing)
            },
            isFollowingResolver = { user ->
                val currentUserId = TokenManager.getUserId(this)
                when {
                    user._id == currentUserId -> true
                    listType == "following" && userId == currentUserId -> true
                    else -> user.followers?.contains(currentUserId) == true
                }
            }
        )

        recyclerUsers.adapter = adapter

        // Determine which list to show first
        listType = intent.getStringExtra("LIST_TYPE") ?: "followers"
        userId = intent.getStringExtra("USER_ID") ?: TokenManager.getUserId(this) ?: ""

        btnFollowers.setOnClickListener {
            listType = "followers"
            loadFollowList()
        }

        btnFollowing.setOnClickListener {
            listType = "following"
            loadFollowList()
        }

        loadFollowList()
    }

    /**
     * Follow or unfollow a user
     */
    private fun handleFollowAction(user: User, currentlyFollowing: Boolean) {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in first", Toast.LENGTH_SHORT).show()
            return
        }

        val call = if (currentlyFollowing) {
            ApiClient.apiService.unfollowUser(user._id, "Bearer $token")
        } else {
            ApiClient.apiService.followUser(user._id, "Bearer $token")
        }

        call.enqueue(object : Callback<FollowResponse> {
            override fun onResponse(call: Call<FollowResponse>, response: Response<FollowResponse>) {
                if (response.isSuccessful && response.body() != null) {
                    val result = response.body()!!
                    Toast.makeText(this@FollowFeedActivity, result.message, Toast.LENGTH_SHORT).show()
                    loadFollowList()

                    // Only send notification when following
                    if (!currentlyFollowing) {
                        val currentUserId = TokenManager.getUserId(this@FollowFeedActivity)
                        if (currentUserId != null) {
                            sendFollowNotification(currentUserId, user._id, user.username)
                        }
                    }
                } else {
                    Toast.makeText(
                        this@FollowFeedActivity,
                        "Failed: ${response.message()}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<FollowResponse>, t: Throwable) {
                Toast.makeText(
                    this@FollowFeedActivity,
                    "Network error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    /**
     * Fetch the list of followers or following users
     */
    private fun loadFollowList() {
        val token = TokenManager.getToken(this)
        if (token.isNullOrEmpty()) {
            Toast.makeText(this, "Please log in", Toast.LENGTH_SHORT).show()
            return
        }

        val call: Call<FollowListResponse> = if (listType == "followers") {
            ApiClient.apiService.getFollowers(userId, "Bearer $token")
        } else {
            ApiClient.apiService.getFollowing(userId, "Bearer $token")
        }

        call.enqueue(object : Callback<FollowListResponse> {
            override fun onResponse(call: Call<FollowListResponse>, response: Response<FollowListResponse>) {
                val body = response.body()
                if (response.isSuccessful && body != null) {
                    users.clear()
                    users.addAll(if (listType == "followers") body.followers else body.following)
                    adapter.notifyDataSetChanged()

                    val title = if (listType == "followers") "Followers" else "Following"
                    Toast.makeText(this@FollowFeedActivity, "$title updated", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this@FollowFeedActivity,
                        "Failed to load $listType",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }

            override fun onFailure(call: Call<FollowListResponse>, t: Throwable) {
                Toast.makeText(
                    this@FollowFeedActivity,
                    "Network error: ${t.message}",
                    Toast.LENGTH_SHORT
                ).show()
            }
        })
    }

    /**
     * Sends OneSignal notification when user follows someone
     */
    private fun sendFollowNotification(followerId: String, followedId: String, followedUsername: String) {
        val jsonBody = JSONObject().apply {
            put("app_id", "165df9e6-a0ea-4a37-a40a-110af7e28ad2")
            put("include_external_user_ids", JSONArray().put(followedId))
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
                conn.setRequestProperty("Authorization", "Basic YOUR_REST_API_KEY")
                conn.doOutput = true
                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }

                val responseCode = conn.responseCode
                Log.d("FollowFeedActivity", "OneSignal response: $responseCode")
            } catch (e: Exception) {
                Log.e("FollowFeedActivity", "Notification failed: ${e.message}")
            }
        }
    }
}
