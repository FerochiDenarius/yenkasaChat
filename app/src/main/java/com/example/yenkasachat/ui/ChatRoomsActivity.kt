package com.example.yenkasachat.ui

import android.content.Context
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
import com.example.yenkasachat.util.SharedPrefs
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChatRoomsActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var chatRoomAdapter: ChatRoomAdapter
    private lateinit var token: String
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

        token = SharedPrefs.getToken(this) ?: ""
        currentUserId = SharedPrefs.getUserId(this) ?: ""


        if (token.isEmpty() || currentUserId.isEmpty()) {
            Toast.makeText(this, "User not logged in", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        loadChatRooms()

        btnCreateRoom.setOnClickListener {
            val recipientUsername = inputUsername.text.toString().trim()
            if (recipientUsername.isEmpty()) {
                Toast.makeText(this, "Please enter a username", Toast.LENGTH_SHORT).show()
            } else {
                createChatRoom(recipientUsername)
            }
        }
    }

    private fun createChatRoom(username: String) {
        Log.d("ChatRoom", "createChatRoom called with username: $username")
        Toast.makeText(this, "Creating chat room with: $username", Toast.LENGTH_SHORT).show()

        val requestBody = mapOf("username" to username)

        ApiClient.apiService.createChatRoom("Bearer $token", requestBody)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    Log.d("ChatRoom", "Response: $response")

                    if (response.isSuccessful) {
                        Log.d("ChatRoom", "Room created successfully!")
                        Toast.makeText(this@ChatRoomsActivity, "Room created!", Toast.LENGTH_SHORT)
                            .show()
                        inputUsername.setText("")
                        loadChatRooms()
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Log.e("ChatRoom", "Failed to create room: $errorMsg")
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            "Failed: $errorMsg",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ChatRoom", "Error creating room", t)
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun loadChatRooms() {
        Log.d("ChatRoomsActivity", "Attempting to load chat rooms with token: $token")

        ApiClient.apiService.getChatRooms("Bearer $token")
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(
                    call: Call<List<ChatRoom>>,
                    response: Response<List<ChatRoom>>
                ) {
                    Log.d("ChatRoomsActivity", "Response received: ${response.code()}")

                    if (response.isSuccessful && response.body() != null) {
                        val rooms = response.body()!!
                        Log.d("ChatRoomsActivity", "Chat rooms loaded: ${rooms.size}")
                        rooms.forEach {
                            Log.d(
                                "ChatRoomsActivity",
                                "Room ID: ${it._id}, LastMessage: ${it.lastMessage}"
                            )
                        }

                        chatRoomAdapter = ChatRoomAdapter(currentUserId) { selectedRoom ->
                            val intent =
                                Intent(this@ChatRoomsActivity, ChatActivity::class.java).apply {
                                    putExtra("roomId", selectedRoom._id)
                                }
                            startActivity(intent)
                        }

                        recyclerView.adapter = chatRoomAdapter
                        chatRoomAdapter.submitList(rooms)

                    } else {
                        val err = response.errorBody()?.string()
                        Log.e(
                            "ChatRoomsActivity",
                            "Failed to load rooms. Code: ${response.code()}, Error: $err"
                        )
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            "Failed to load rooms",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error loading chatrooms: ${t.message}", t)
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
