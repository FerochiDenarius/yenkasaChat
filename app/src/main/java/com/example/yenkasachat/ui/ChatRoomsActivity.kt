package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.ChatRoomAdapter
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.SharedPrefs // Using SharedPrefs as in your original
// import com.example.yenkasachat.util.TokenManager // Or use TokenManager if you've centralized to it
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException // For reading error body

class ChatRoomsActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var chatRoomAdapter: ChatRoomAdapter
    // 'token' class property can be removed if only used for the initial check and interceptor handles API calls
    // private lateinit var token: String
    private lateinit var currentUserId: String // Still needed for the ChatRoomAdapter
    private lateinit var btnCreateRoom: Button
    private lateinit var inputUsername: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_rooms)

        recyclerView = findViewById(R.id.recyclerViewChatRooms)
        recyclerView.layoutManager = LinearLayoutManager(this)

        btnCreateRoom = findViewById(R.id.btnCreateRoom)
        inputUsername = findViewById(R.id.inputUsername)

        // Retrieve token and userId for initial authentication check
        val retrievedToken = SharedPrefs.getToken(this)
        currentUserId = SharedPrefs.getUserId(this) ?: "" // Assign to class property as it's used by adapter

        // If you were using TokenManager:
        // val retrievedToken = TokenManager.getToken(this)
        // currentUserId = TokenManager.getUserId(this) ?: ""

        if (retrievedToken.isNullOrEmpty() || currentUserId.isEmpty()) {
            Toast.makeText(this, "User not logged in. Please log in again.", Toast.LENGTH_LONG).show()
            // Optionally, navigate to LoginActivity
            // startActivity(Intent(this, LoginActivity::class.java).apply {
            //     flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            // })
            finish()
            return
        }
        // this.token = retrievedToken // Can be removed if not directly used later in API calls

        // Initialize adapter with currentUserId.
        // The list will be submitted after loading.
        chatRoomAdapter = ChatRoomAdapter(currentUserId) { selectedRoom ->
            val intent = Intent(this@ChatRoomsActivity, ChatActivity::class.java).apply {
                putExtra("roomId", selectedRoom._id)
                // Optionally pass room name or participant details if needed by ChatActivity
                // val otherParticipant = selectedRoom.participants.find { it._id != currentUserId }
                // putExtra("chatPartnerName", otherParticipant?.username ?: "Chat")
            }
            startActivity(intent)
        }
        recyclerView.adapter = chatRoomAdapter


        loadChatRooms()

        btnCreateRoom.setOnClickListener {
            val recipientUsername = inputUsername.text.toString().trim()
            if (recipientUsername.isEmpty()) {
                Toast.makeText(this, "Please enter a username to create a chat with", Toast.LENGTH_SHORT).show()
            } else {
                createChatRoom(recipientUsername)
            }
        }
    }

    private fun createChatRoom(username: String) {
        Log.d("ChatRoomsActivity", "Attempting to create chat room with username: $username")
        // Toast.makeText(this, "Creating chat room with: $username...", Toast.LENGTH_SHORT).show() // Optional progress toast

        val requestBody = mapOf("username" to username)

        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.createChatRoom(requestBody)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful && response.body() != null && response.body()!!.success) { // Check success flag
                        Log.d("ChatRoomsActivity", "Room created successfully! Room ID: ${response.body()!!.roomId}")
                        Toast.makeText(this@ChatRoomsActivity, "Chat room created!", Toast.LENGTH_SHORT).show()
                        inputUsername.setText("") // Clear input field
                        loadChatRooms() // Refresh the list of chat rooms
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = response.body()?.success // For debugging
                        Log.e("ChatRoomsActivity", "Failed to create room: $errorMsg (Code: ${response.code()}, Success: $successFlag)")
                        Toast.makeText(this@ChatRoomsActivity, "Failed to create room: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error creating room: ${t.message}", t)
                    Toast.makeText(this@ChatRoomsActivity, "Error creating room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadChatRooms() {
        Log.d("ChatRoomsActivity", "Attempting to load chat rooms...") // Token detail removed from log

        // Token is no longer passed here; interceptor handles it.
        ApiClient.apiService.getChatRooms()
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(
                    call: Call<List<ChatRoom>>,
                    response: Response<List<ChatRoom>>
                ) {
                    Log.d("ChatRoomsActivity", "Chat rooms response received: Code ${response.code()}")

                    if (response.isSuccessful && response.body() != null) {
                        val rooms = response.body()!!
                        Log.d("ChatRoomsActivity", "Chat rooms loaded: ${rooms.size}")
                        // rooms.forEach { room -> // Detailed logging can be verbose for many rooms
                        //     Log.d("ChatRoomsActivity", "Room ID: ${room._id}, LastMessage: ${room.lastMessage?.content}")
                        // }

                        // Adapter is initialized in onCreate, just submit list here
                        chatRoomAdapter.submitList(rooms)

                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ChatRoomsActivity", "Failed to load rooms. Code: ${response.code()}, Error: $errorMsg")
                        Toast.makeText(this@ChatRoomsActivity, "Failed to load rooms: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error loading chat rooms: ${t.message}", t)
                    Toast.makeText(this@ChatRoomsActivity, "Error loading chat rooms: ${t.message}", Toast.LENGTH_SHORT).show()
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
