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
// Assuming CreateChatRoomRequest is now used by your ApiService
import com.example.yenkasachat.model.CreateChatRoomRequest
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
// Removed: import kotlin.io.path.name // This import was likely added due to the incorrect 'name' access
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class ChatRoomsActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var chatRoomAdapter: ChatRoomAdapter
    private lateinit var currentUserId: String
    private lateinit var btnCreateRoom: Button
    private lateinit var inputUsername: EditText

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_rooms)

        recyclerView = findViewById(R.id.recyclerViewChatRooms)
        recyclerView.layoutManager = LinearLayoutManager(this)

        btnCreateRoom = findViewById(R.id.btnCreateRoom)
        inputUsername = findViewById(R.id.inputUsername)

        val retrievedToken = TokenManager.getToken(this)
        currentUserId = TokenManager.getUserId(this) ?: ""

        if (retrievedToken.isNullOrEmpty() || currentUserId.isEmpty()) {
            Toast.makeText(this, "User not logged in. Please log in again.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        chatRoomAdapter = ChatRoomAdapter(currentUserId) { selectedRoom ->
            val intent = Intent(this@ChatRoomsActivity, ChatActivity::class.java).apply {
                putExtra("roomId", selectedRoom._id) // This assumes your ChatRoom has an _id field

                val chatName = determineChatDisplayNameForActivity(selectedRoom, currentUserId)
                putExtra("chatPartnerName", chatName)
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

    /**
     * Determines a display name for the chat to be passed to ChatActivity.
     * This logic relies on the properties available in your existing ChatRoom model.
     */
    private fun determineChatDisplayNameForActivity(chatRoom: ChatRoom, currentUserId: String): String {
        // Assuming chatRoom.participants is List<Participant>?
        // and Participant has _id: String and username: String?
        val otherParticipants = chatRoom.participants?.filter { it._id != currentUserId }

        return when {
            otherParticipants == null -> "Chat" // Participants list was null
            otherParticipants.isEmpty() -> "Chat with Yourself" // Or some other default
            otherParticipants.size == 1 -> otherParticipants.first().username ?: "Chat" // 1-on-1
            else -> {
                // For group chats (more than one other participant)
                // We construct the name from participant usernames as chatRoom.name does not exist.
                otherParticipants.take(2).joinToString(", ") { it.username ?: "User" } +
                        if (otherParticipants.size > 2) "..." else ""
            }
        }
    }


    private fun createChatRoom(username: String) {
        Log.d("ChatRoomsActivity", "Attempting to create chat room with username: $username")

        // Assuming your ApiService.createChatRoom now expects CreateChatRoomRequest
        // If it still expects a Map: val requestBody = mapOf("username" to username)
        val request = CreateChatRoomRequest(username = username)

        ApiClient.apiService.createChatRoom(request)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val responseBody = response.body()
                    if (response.isSuccessful && responseBody != null && responseBody.success) {
                        Log.d("ChatRoomsActivity", "Room created successfully! Room ID: ${responseBody.roomId}")
                        Toast.makeText(this@ChatRoomsActivity, "Chat room created!", Toast.LENGTH_SHORT).show()
                        inputUsername.setText("")
                        loadChatRooms() // Refresh the list
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = responseBody?.success
                        val actualMessage = responseBody?.message ?: errorMsg
                        Log.e("ChatRoomsActivity", "Failed to create room: $actualMessage (Code: ${response.code()}, Success: $successFlag)")
                        Toast.makeText(this@ChatRoomsActivity, "Failed to create room: $actualMessage", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error creating room: ${t.message}", t)
                    Toast.makeText(this@ChatRoomsActivity, "Error creating room: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun loadChatRooms() {
        Log.d("ChatRoomsActivity", "Attempting to load chat rooms...")
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

                        // ✅ Remove duplicate chat rooms by unique participants or ID
                        val uniqueRooms = rooms.distinctBy { room ->
                            // Prefer unique room ID if available
                            room._id ?: room.participants
                                ?.filter { it._id != currentUserId }
                                ?.joinToString(",") { it._id ?: "" }
                        }

                        Log.d("ChatRoomsActivity", "Filtered unique chat rooms: ${uniqueRooms.size}")

                        chatRoomAdapter.submitList(uniqueRooms)
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

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.let { errorJson ->
                if (errorJson.contains("\"message\"")) {
                    try {
                        errorJson.split("\"message\":\"")[1].split("\"")[0]
                    } catch (e: Exception) { errorJson }
                } else { errorJson }
            } ?: "Error: ${response.code()} ${response.message()} (No specific error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
