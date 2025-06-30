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
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewUsers: RecyclerView
    private var token: String? = null
    private var userId: String? = null
    private lateinit var userAdapter: UserAdapter
    private val users = mutableListOf<User>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val prefs: SharedPreferences = getSharedPreferences("auth", MODE_PRIVATE)
        token = prefs.getString("token", null)
        userId = prefs.getString("userId", null)

        Log.d("MainActivity", "Loaded token: $token")
        Log.d("MainActivity", "Loaded userId: $userId")

        if (!token.isNullOrEmpty() && !userId.isNullOrEmpty()) {
            recyclerViewUsers = findViewById(R.id.recyclerViewUsers)
            recyclerViewUsers.layoutManager = LinearLayoutManager(this)
            userAdapter = UserAdapter(users) { selectedUser ->
                showUserOptions(selectedUser)
            }
            recyclerViewUsers.adapter = userAdapter

            fetchAllUsers()

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
            findViewById<Button>(R.id.btnLogout).setOnClickListener {
                prefs.edit().clear().apply()
                Toast.makeText(this, "Logged out", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
            }
        } else {
            Log.w("MainActivity", "Missing token or userId — redirecting to LoginActivity")
            Toast.makeText(this, "Please log in again", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun fetchAllUsers() {
        val currentUserId = userId ?: return
        val authToken = token ?: return

        ApiClient.apiService.getAllUsers("Bearer $authToken")
            .enqueue(object : Callback<List<User>> {
                override fun onResponse(call: Call<List<User>>, response: Response<List<User>>) {
                    if (response.isSuccessful && response.body() != null) {
                        val list = response.body()!!.filter { it._id != currentUserId }
                        users.clear()
                        users.addAll(list)
                        userAdapter.notifyDataSetChanged()
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to load users", Toast.LENGTH_SHORT).show()
                        Log.e("MainActivity", "Load users error: ${response.errorBody()?.string()}")
                    }
                }

                override fun onFailure(call: Call<List<User>>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                    Log.e("MainActivity", "Network failure: ${t.message}", t)
                }
            })
    }

    private fun showUserOptions(user: User) {
        val popup = PopupMenu(this, recyclerViewUsers)
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
        val authToken = token ?: return
        val body = mapOf("username" to username)

        ApiClient.apiService.createChatRoom("Bearer $authToken", body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val roomId = response.body()!!.roomId
                        val intent = Intent(this@MainActivity, ChatActivity::class.java)
                        intent.putExtra("roomId", roomId)
                        startActivity(intent)
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Chat room creation failed"
                        Toast.makeText(this@MainActivity, errorMsg, Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addUserToContacts(username: String) {
        val authToken = token ?: return

        ApiClient.apiService.addContact("Bearer $authToken", mapOf("username" to username))
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@MainActivity, "Contact added!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to add contact", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun openExistingChatRoom(recipientId: String) {
        val authToken = token ?: return

        ApiClient.apiService.getChatRooms("Bearer $authToken")
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(call: Call<List<ChatRoom>>, response: Response<List<ChatRoom>>) {
                    if (response.isSuccessful && response.body() != null) {
                        val existingRoom = response.body()!!.find { room ->
                            room.participants.any { it._id == recipientId }
                        }

                        if (existingRoom != null) {
                            val intent = Intent(this@MainActivity, ChatActivity::class.java)
                            intent.putExtra("roomId", existingRoom._id)
                            startActivity(intent)
                        } else {
                            Toast.makeText(this@MainActivity, "No previous chat found", Toast.LENGTH_SHORT).show()
                        }
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to fetch chat rooms", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Toast.makeText(this@MainActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
