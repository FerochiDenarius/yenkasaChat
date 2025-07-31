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
import com.example.yenkasachat.model.* // Ensure all your models are imported
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.google.gson.Gson // For serializing objects to JSON for logging
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var recyclerViewUsers: RecyclerView
    private lateinit var userAdapter: UserAdapter
    private val users = mutableListOf<User>()
    private lateinit var userId: String
    private val gson = Gson() // For serializing successful response body to JSON for logging

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val retrievedToken = TokenManager.getToken(this)
        val retrievedUserId = TokenManager.getUserId(this)

        Log.d("MainActivity", "Retrieved Token: $retrievedToken")
        Log.d("MainActivity", "Retrieved UserID in onCreate: $retrievedUserId")

        if (retrievedToken.isNullOrBlank() || retrievedUserId.isNullOrBlank()) {
            Log.w("MainActivity", "Token or UserID is null/blank. Redirecting to LoginActivity.")
            Toast.makeText(this, "Authentication required. Please log in again.", Toast.LENGTH_LONG).show()
            startActivity(Intent(this, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
            finish()
            return
        }
        this.userId = retrievedUserId
        setContentView(R.layout.activity_main)
        setupUI()
        fetchAllUsers()

        findViewById<Button>(R.id.btnLogout).setOnClickListener {
            TokenManager.clearAll(this)
            Toast.makeText(this, "Logged out successfully", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, LoginActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            })
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
            Toast.makeText(this, "Verification feature coming soon!", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnSettings).setOnClickListener {
            Toast.makeText(this, "Settings feature coming soon!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun fetchAllUsers() {
        ApiClient.apiService.getAllUsers().enqueue(object : Callback<List<User>> {
            override fun onResponse(call: Call<List<User>>, response: Response<List<User>>) {
                if (response.isSuccessful && response.body() != null) {
                    val filteredUsers = response.body()!!.filter { it._id != userId }
                    users.clear()
                    users.addAll(filteredUsers)
                    userAdapter.notifyDataSetChanged()
                    if (users.isEmpty()) {
                        Log.d("MainActivity", "No other users found to display.")
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
                    // Make sure user.username is not null before passing
                    user.username?.let { createChatRoomWithUser(it) }
                        ?: Toast.makeText(this, "Username not available for this user.", Toast.LENGTH_SHORT).show()
                    true
                }
                R.id.action_add_contact -> {
                    user.username?.let { addUserToContacts(it) }
                        ?: Toast.makeText(this, "Username not available for this user.", Toast.LENGTH_SHORT).show()
                    true
                }
                R.id.action_continue_chat -> {
                    openExistingChatRoom(user._id) // user._id is the recipientId
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun createChatRoomWithUser(username: String) {
        Log.d("CREATE_CHAT", "Attempting to create/get chat with username: $username")
        // Your ApiService createChatRoom probably expects CreateChatRoomRequest
        // If it expects a map: val body = mapOf("username" to username)
        // If it expects a data class:
        val requestBody = CreateChatRoomRequest(username = username)

        ApiClient.apiService.createChatRoom(requestBody) // Use requestBody if it's a data class
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(call: Call<CreateChatRoomResponse>, response: Response<CreateChatRoomResponse>) {
                    val responseBody = response.body()
                    if (response.isSuccessful && responseBody != null) {
                        if (responseBody.success) {
                            val roomId = responseBody.roomId
                            // CORRECTED: chatPartnerName is not in CreateChatRoomResponse. Use the 'username' parameter.
                            val partnerName = username
                            Log.i("CREATE_CHAT", "Successfully created/found room. RoomID: $roomId, Partner: $partnerName")
                            startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                                putExtra("roomId", roomId)
                                putExtra("chatPartnerName", partnerName) // Pass the determined partner name
                            })
                        } else {
                            // Backend indicated failure, but the API call itself was successful (e.g., 200 OK but { success: false })
                            val message = responseBody.message ?: "Chat room operation failed."
                            Log.e("CREATE_CHAT", "Chat room creation indicated failure by server: $message (Code: ${response.code()})")
                            Toast.makeText(this@MainActivity, "Chat room creation failed: $message", Toast.LENGTH_LONG).show()
                        }
                    } else {
                        // API call failed (e.g., 4xx, 5xx error) or body was null
                        val errorDetail = parseError(response)
                        val successFlag = responseBody?.success // May be null if responseBody is null
                        Log.e("CREATE_CHAT", "Chat room creation/retrieval API call failed: $errorDetail (Code: ${response.code()}, Success Flag: $successFlag)")
                        Toast.makeText(this@MainActivity, "Chat room creation/retrieval failed: $errorDetail", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("CREATE_CHAT", "Network error creating/getting chat room: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error creating/getting chat room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun addUserToContacts(username: String) {
        // Assuming your addContact endpoint expects a map like: mapOf("username" to username)
        // If it expects a data class, create one.
        ApiClient.apiService.addContact(mapOf("username" to username))
            .enqueue(object : Callback<Contact> { // Assuming Contact is your response model for adding a contact
                override fun onResponse(call: Call<Contact>, response: Response<Contact>) {
                    val msg: String
                    if (response.isSuccessful && response.body() != null) {
                        msg = "Contact '${response.body()!!.username}' added!" // Ensure Contact model has 'username'
                        Log.d("MainActivity", "Contact added successfully: ${response.body()?.username}")
                    } else {
                        val errorDetail = parseError(response)
                        msg = "Failed to add contact: $errorDetail"
                        Log.e("MainActivity", "Failed to add contact: $errorDetail (Code: ${response.code()})")
                    }
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_SHORT).show()
                }

                override fun onFailure(call: Call<Contact>, t: Throwable) {
                    Log.e("MainActivity", "Network error adding contact: ${t.message}", t)
                    Toast.makeText(this@MainActivity, "Error adding contact: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun openExistingChatRoom(recipientId: String) {
        Log.d("OPEN_CHAT_ROOM", "Attempting to open existing chat room with recipientId: $recipientId")
        ApiClient.apiService.getChatRooms().enqueue(object : Callback<List<ChatRoom>> {
            override fun onResponse(call: Call<List<ChatRoom>>, response: Response<List<ChatRoom>>) {
                if (response.isSuccessful && response.body() != null) {
                    // Log the deserialized successful response body as JSON
                    val rawJsonResponse = gson.toJson(response.body())
                    Log.d("OPEN_CHAT_ROOM", "Raw JSON Response (from successful body of getChatRooms): $rawJsonResponse")

                    val allRooms = response.body()!!
                    Log.d("OPEN_CHAT_ROOM", "Number of rooms deserialized: ${allRooms.size}")

                    allRooms.forEachIndexed { index, room ->
                        val participantDetails = room.participants
                            ?.joinToString { p -> "User(id=${p._id}, name=${p.username ?: "N/A"})" }
                            ?: "No participants"
                        // Ensure your ChatRoom.kt has 'createdAt' (as String?)
                        Log.d("OPEN_CHAT_ROOM", "Deserialized Room $index: ID=${room._id}, Participants=[$participantDetails], CreatedAt=${room.createdAtFormatted}") // Using formatted getter
                    }

                    val currentLoggedInUserId = this@MainActivity.userId
                    Log.d("OPEN_CHAT_ROOM", "Filtering with currentLoggedInUserId: $currentLoggedInUserId, targetRecipientId: $recipientId")

                    val chatRoom = allRooms.find { room ->
                        val roomParticipantsString = room.participants?.joinToString { it._id } ?: ""
                        val hasTargetRecipient = room.participants?.any { participant -> participant._id == recipientId } ?: false
                        val hasCurrentUser = room.participants?.any { participant -> participant._id == currentLoggedInUserId } ?: false
                        // For a 1-on-1 chat, size should ideally be 2.
                        // If you allow group chats initiated this way, >= 2 is fine.
                        // Let's assume strict 1-on-1 for this find.
                        val meetsSizeRequirement = (room.participants?.size ?: 0) == 2


                        val foundLog = "Room ID: ${room._id}, All Participant IDs: [$roomParticipantsString]. " +
                                "Comparing with targetRecipientID: $recipientId (Match? $hasTargetRecipient), " +
                                "currentUser ID: $currentLoggedInUserId (Match? $hasCurrentUser), " +
                                "Participant Count: ${room.participants?.size} (Meets Size for 1-on-1? $meetsSizeRequirement)"
                        Log.d("OPEN_CHAT_ROOM_FILTER", foundLog)

                        room.participants != null &&
                                hasTargetRecipient &&
                                hasCurrentUser &&
                                meetsSizeRequirement // Strict check for 2 participants for a 1-on-1 chat
                    }

                    if (chatRoom != null) {
                        Log.i("OPEN_CHAT_ROOM", "Found existing 1-on-1 chat room: ${chatRoom._id} with recipientId: $recipientId")
                        startActivity(Intent(this@MainActivity, ChatActivity::class.java).apply {
                            putExtra("roomId", chatRoom._id)
                            val recipientUser = chatRoom.participants?.find { it._id == recipientId }
                            putExtra("chatPartnerName", recipientUser?.username ?: "Chat")
                        })
                    } else {
                        Log.w("OPEN_CHAT_ROOM", "No existing 1-on-1 chat room found with user ID: $recipientId. Attempting to create new.")
                        // Toast.makeText(this@MainActivity, "No previous direct chat found. Starting new one.", Toast.LENGTH_SHORT).show() // Optional Toast
                        val targetUser = users.find { it._id == recipientId }
                        targetUser?.username?.let {
                            Log.d("OPEN_CHAT_ROOM", "No existing room, attempting to create new one with username: ${it}")
                            createChatRoomWithUser(it)
                        } ?: run {
                            Log.w("OPEN_CHAT_ROOM", "No existing room, and could not find username for recipientId: $recipientId to create new one.")
                            Toast.makeText(this@MainActivity, "Could not start chat: User details not found.", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else {
                    // Log raw error body if request was not successful
                    // Ensure parseError handles the case where errorBody might have already been read if you log it directly first.
                    val errorDetail = parseError(response) // parseError will try to read errorBody.string()
                    Log.e("OPEN_CHAT_ROOM", "Failed to fetch chat rooms: $errorDetail (Code: ${response.code()})")
                    // If you want to log the raw error string separately:
                    // val errorBodyString = response.errorBody()?.string() // CAUTION: Consumes the stream
                    // Log.e("OPEN_CHAT_ROOM", "Raw Error Response: $errorBodyString")
                    Toast.makeText(this@MainActivity, "Failed to fetch chat rooms: $errorDetail", Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                Log.e("OPEN_CHAT_ROOM", "Network failure while fetching chat rooms: ${t.message}", t)
                Toast.makeText(this@MainActivity, "Error connecting to server: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun parseError(response: Response<*>): String {
        return try {
            // Attempt to read the error body. This can only be done once per response.
            response.errorBody()?.string()?.let { errorJson ->
                // Basic error message extraction.
                // If your backend sends a structured error like { "message": "details" },
                // you could try to parse 'message' from errorJson using Gson here.
                // For now, returning the whole error string or a part of it.
                if (errorJson.length > 200) "${errorJson.substring(0, 200)}..." else errorJson // Prevent overly long toasts
            } ?: "Error: ${response.code()} ${response.message()} (No specific error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
