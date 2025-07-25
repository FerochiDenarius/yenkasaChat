package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.PopupMenu
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.UserAdapter
import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.network.ApiService
import com.example.yenkasachat.util.SharedPrefs
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewUsers: RecyclerView
    private lateinit var userAdapter: UserAdapter
    private val users = mutableListOf<User>()

    private var token: String? = null
    private var userId: String? = null
    private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Sync token from SharedPrefs to TokenManager
        val savedToken = SharedPrefs.getToken(this)
        if (!savedToken.isNullOrEmpty()) {
            TokenManager.saveToken(this, savedToken)
        }

        // Now initialize ApiClient
        ApiClient.init(applicationContext)
        apiService = ApiClient.apiService

        token = SharedPrefs.getToken(this)
        userId = SharedPrefs.getUserId(this)

        Log.d("MainActivity", "Token: $token")
        Log.d("MainActivity", "UserID: $userId")

        if (token.isNullOrBlank() || userId.isNullOrBlank()) {
            Toast.makeText(this, "Please log in again", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        setupUI()
        fetchAllUsers()

        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            SharedPrefs.clearToken(this)
            SharedPrefs.clearUserId(this)
            Toast.makeText(this, "Logged out", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun setupUI() {
        recyclerViewUsers = findViewById(R.id.recyclerViewUsers)
        recyclerViewUsers.layoutManager = LinearLayoutManager(this)
        userAdapter = UserAdapter(users) { selectedUser, anchorView ->
            showUserOptions(selectedUser, anchorView)
        }
        recyclerViewUsers.adapter = userAdapter

        findViewById<Button>(R.id.btnContacts).setOnClickListener {
            startActivity(Intent(this, ContactsActivity::class.java))
        }
        findViewById<Button>(R.id.btnChatRooms).setOnClickListener {
            startActivity(Intent(this, ChatRoomsActivity::class.java))
        }
        findViewById<Button>(R.id.btnAccountInfo).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }
        findViewById<Button>(R.id.btnVerify).setOnClickListener {
            Toast.makeText(this, "Verification coming soon", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            Toast.makeText(this, "Settings coming soon", Toast.LENGTH_SHORT).show()
        }
    }

    private fun fetchAllUsers() {
        apiService.getAllUsers("Bearer $token")
            .enqueue(object : Callback<List<User>> {
                override fun onResponse(call: Call<List<User>>, response: Response<List<User>>) {
                    if (response.isSuccessful && response.body() != null) {
                        val currentUserId = userId ?: return
                        val filtered = response.body()!!.filter { it._id != currentUserId }
                        users.clear()
                        users.addAll(filtered)
                        userAdapter.notifyDataSetChanged()
                    } else {
                        Log.e("MainActivity", "Failed to load users: ${response.code()}")
                        Toast.makeText(this@MainActivity, "Failed to load users", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<User>>, t: Throwable) {
                    Log.e("MainActivity", "Network failure", t)
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun showUserOptions(user: User, anchorView: View) {
        val popup = PopupMenu(this, anchorView)
        popup.menuInflater.inflate(R.menu.menu_user_options, popup.menu)
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_create_chat -> {
                    createChatRoomWithUser(user.username)
                    true
                }
                R.id.action_add_contact -> {
                    addUserToContacts(user.username)
                    true
                }
                R.id.action_continue_chat -> {
                    openExistingChatRoom(user._id)
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun createChatRoomWithUser(username: String) {
        val body = mapOf("username" to username)
        apiService.createChatRoom("Bearer $token", body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(call: Call<CreateChatRoomResponse>, response: Response<CreateChatRoomResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        val roomId = response.body()!!.roomId
                        startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                        })
                    } else {
                        Toast.makeText(this@MainActivity, "Chat room creation failed", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addUserToContacts(username: String) {
        apiService.addContact("Bearer $token", mapOf("username" to username))
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    val msg = if (response.isSuccessful) "Contact added!" else "Failed to add contact"
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun openExistingChatRoom(recipientId: String) {
        apiService.getChatRooms("Bearer $token")
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(call: Call<List<ChatRoom>>, response: Response<List<ChatRoom>>) {
                    if (response.isSuccessful) {
                        val allRooms = response.body() ?: emptyList()
                        val chatRoom = allRooms.find { room ->
                            room.participants?.any { it._id == recipientId } == true
                        }

                        if (chatRoom != null) {
                            startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                                putExtra("roomId", chatRoom._id)
                            })
                        } else {
                            Toast.makeText(this@MainActivity, "No previous chat found", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to fetch chat rooms", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("MainActivity", "Error fetching chat rooms", t)
                    Toast.makeText(this@MainActivity, "Error connecting to server", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
