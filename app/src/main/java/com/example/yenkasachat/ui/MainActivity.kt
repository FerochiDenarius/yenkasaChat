package com.example.yenkasachat.ui

import android.content.Intent
import android.content.SharedPreferences
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
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewUsers: RecyclerView
    private lateinit var userAdapter: UserAdapter
    private val users = mutableListOf<User>()

    private var token: String? = null
    private var userId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs: SharedPreferences = getSharedPreferences("auth", MODE_PRIVATE)
        token = prefs.getString("token", null)
        userId = prefs.getString("userId", null)

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
            prefs.edit().clear().apply()
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
        ApiClient.apiService.getAllUsers("Bearer $token")
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
                        Toast.makeText(
                            this@MainActivity,
                            "Failed to load users",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<User>>, t: Throwable) {
                    Log.e("MainActivity", "Network failure", t)
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
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
        ApiClient.apiService.createChatRoom("Bearer $token", body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val roomId = response.body()!!.roomId
                        startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                        })
                    } else {
                        Toast.makeText(
                            this@MainActivity,
                            "Chat room creation failed",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    private fun addUserToContacts(username: String) {
        ApiClient.apiService.addContact("Bearer $token", mapOf("username" to username))
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    val msg =
                        if (response.isSuccessful) "Contact added!" else "Failed to add contact"
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    private fun openExistingChatRoom(recipientId: String) {
        ApiClient.apiService.getChatRooms("Bearer $token")
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(
                    call: Call<List<ChatRoom>>,
                    response: Response<List<ChatRoom>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val allRooms = response.body()!!
                        Log.d("MainActivity", "Fetched ${allRooms.size} chat rooms")

                        val chatRoom = allRooms.find { room ->
                            room.participants.any { participant -> participant._id == recipientId }
                        }

                        if (chatRoom != null && !chatRoom._id.isNullOrEmpty()) {
                            Log.d("MainActivity", "Opening chat room: ${chatRoom._id}")
                            startActivity(
                                Intent(
                                    this@MainActivity,
                                    ChatActivity::class.java
                                ).apply {
                                    putExtra("roomId", chatRoom._id)
                                })
                        } else {
                            Log.w("MainActivity", "No chat room found for user $recipientId")
                            Toast.makeText(
                                this@MainActivity,
                                "No previous chat found",
                                Toast.LENGTH_SHORT
                            ).show()
                        }
                    } else {
                        Log.e("MainActivity", "Failed to fetch chat rooms: ${response.code()}")
                        Toast.makeText(
                            this@MainActivity,
                            "Failed to fetch chat rooms",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("MainActivity", "Network error: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }
}