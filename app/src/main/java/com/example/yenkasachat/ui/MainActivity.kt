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
// ApiService is now likely obtained directly from ApiClient.apiService
// import com.example.yenkasachat.network.ApiService
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException // For reading error body

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewUsers: RecyclerView
    private lateinit var userAdapter: UserAdapter
    private val users = mutableListOf<User>()

    // userId is still needed for filtering users and finding chat rooms.
    // The 'token' class property is no longer strictly needed if all API calls
    // use the interceptor. However, keeping it from TokenManager for the initial check
    // is fine, or you can make it a local variable in onCreate.
    private lateinit var userId: String
    // private lateinit var token: String // Can be removed if not used elsewhere after onCreate

    // apiService is directly accessible from ApiClient singleton
    // private lateinit var apiService: ApiService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Log.d("MainActivity", "🚀 MainActivity onCreate starting.")

        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        Log.d("MainActivity", "Retrieved Token: $retrievedToken") // Still good for debugging
        Log.d("MainActivity", "Retrieved UserID: $retrievedUserId")

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Log.w("MainActivity", "Token or UserID is null/blank. Redirecting to LoginActivity.")
            Toast.makeText(this, "Authentication required. Please log in again.", Toast.LENGTH_LONG).show()
            val intent = Intent(this, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            finish()
            return
        }

        // Assign userId as it's used in filtering logic.
        // The token variable is less critical at class level if interceptor handles all auth.
        this.userId = retrievedUserId
        // this.token = retrievedToken // Can be removed if not directly used later

        setContentView(R.layout.activity_main)

        // Initialize ApiClient if it has an init method.
        // ApiService instance is obtained from ApiClient.apiService
        // If ApiClient.init is for context-wide setup (like SharedPreferences for TokenManager within ApiClient), call it.
        // ApiClient.init(applicationContext) // Call this if your ApiClient needs app context for setup

        setupUI()
        fetchAllUsers()

        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully", Toast.LENGTH_SHORT).show()
            val intent = Intent(this, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            finish()
        }
    }

    private fun setupUI() {
        recyclerViewUsers = findViewById(R.id.recyclerViewUsers)
        recyclerViewUsers.layoutManager = LinearLayoutManager(this)
        // userId (class property) is available here if UserAdapter needs it directly,
        // though it's often better if adapter logic is self-contained or data passed explicitly.
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
            // Consider navigating to VerificationActivity or implementing the feature
            Toast.makeText(this, "Verification feature coming soon!", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            // Consider navigating to SettingsActivity or implementing the feature
            Toast.makeText(this, "Settings feature coming soon!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun fetchAllUsers() {
        // Token is no longer passed here; interceptor handles it.
        // apiService is now ApiClient.apiService
        ApiClient.apiService.getAllUsers()
            .enqueue(object : Callback<List<User>> {
                override fun onResponse(call: Call<List<User>>, response: Response<List<User>>) {
                    if (response.isSuccessful && response.body() != null) {
                        // Use class property 'userId' which is guaranteed non-null here after onCreate check
                        val filteredUsers = response.body()!!.filter { it._id != userId }
                        users.clear()
                        users.addAll(filteredUsers)
                        userAdapter.notifyDataSetChanged()
                        if (users.isEmpty()) {
                            Log.d("MainActivity", "No other users found to display.")
                            // Optionally show a message like "No other users available"
                        }
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("MainActivity", "Failed to load users: $errorMsg (Code: ${response.code()})")
                        Toast.makeText(this@MainActivity, "Failed to load users: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<User>>, t: Throwable) {
                    Log.e("MainActivity", "Network failure while fetching users: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error fetching users: ${t.message}", Toast.LENGTH_SHORT).show()
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
                    openExistingChatRoom(user._id) // Pass user._id which is recipientId
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun createChatRoomWithUser(username: String) {
        val body = mapOf("username" to username)
        // Token is no longer passed here; interceptor handles it.
        // apiService is now ApiClient.apiService
        ApiClient.apiService.createChatRoom(body)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(call: Call<CreateChatRoomResponse>, response: Response<CreateChatRoomResponse>) {
                    if (response.isSuccessful && response.body() != null && response.body()!!.success) { // Check success flag if your API returns it
                        val roomId = response.body()!!.roomId
                        startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", roomId)
                            putExtra("chatPartnerName", username) // Good to pass for ChatActivity UI
                        })
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = response.body()?.success // For debugging
                        Log.e("MainActivity", "Chat room creation failed: $errorMsg (Code: ${response.code()}, Success: $successFlag)")
                        Toast.makeText(this@MainActivity, "Chat room creation failed: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("MainActivity", "Error creating chat room: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error creating chat room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addUserToContacts(username: String) {
        // Token is no longer passed here; interceptor handles it.
        // apiService is now ApiClient.apiService
        ApiClient.apiService.addContact(mapOf("username" to username))
            .enqueue(object : Callback<Contact> {
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    val msg: String
                    if (response.isSuccessful && response.body() != null) {
                        msg = "Contact '${response.body()!!.username}' added!"
                        Log.d("MainActivity", "Contact added successfully: ${response.body()?.username}")
                        // Optionally, you might want to refresh a contact list or give more specific feedback
                    } else {
                        val errorDetail = parseError(response)
                        msg = "Failed to add contact: $errorDetail"
                        Log.e("MainActivity", "Failed to add contact: $errorDetail (Code: ${response.code()})")
                    }
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Log.e("MainActivity", "Error adding contact: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error adding contact: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun openExistingChatRoom(recipientId: String) {
        // Token is no longer passed here; interceptor handles it.
        // apiService is now ApiClient.apiService
        ApiClient.apiService.getChatRooms() // Assuming this fetches all rooms for the current user (token implies user)
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(call: Call<List<ChatRoom>>, response: Response<List<ChatRoom>>) {
                    if (response.isSuccessful) {
                        val allRooms = response.body() ?: emptyList()
                        // Use class property 'userId' which is guaranteed non-null here
                        val chatRoom = allRooms.find { room ->
                            // Ensure participants list is not null and current user is not the only participant
                            room.participants != null &&
                                    room.participants.any { participant -> participant._id == recipientId } &&
                                    room.participants.any { participant -> participant._id == userId } &&
                                    room.participants.size > 1 // Ensures it's a chat with someone else
                        }

                        if (chatRoom != null) {
                            startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                                putExtra("roomId", chatRoom._id)
                                // Find recipient's name to pass to ChatActivity if desired
                                val recipient = chatRoom.participants?.find { it._id == recipientId }
                                putExtra("chatPartnerName", recipient?.username ?: "Chat")
                            })
                        } else {
                            Log.d("MainActivity", "No existing direct chat room found with user ID: $recipientId")
                            Toast.makeText(this@MainActivity, "No previous direct chat found with this user.", Toast.LENGTH_SHORT).show()
                            // Optionally, you could call createChatRoomWithUser here if no existing room is found
                        }
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("MainActivity", "Failed to fetch chat rooms: $errorMsg (Code: ${response.code()})")
                        Toast.makeText(this@MainActivity, "Failed to fetch chat rooms: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("MainActivity", "Error fetching chat rooms: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error connecting to server: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    // Helper function to parse error messages (can be moved to a utility class)
    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string() ?: "Unknown error (empty error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
