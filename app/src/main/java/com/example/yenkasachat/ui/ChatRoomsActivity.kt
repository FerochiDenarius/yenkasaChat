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

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        currentUserId = prefs.getString("userId", "") ?: ""

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
        val requestBody = mapOf("username" to username)

        ApiClient.apiService.createChatRoom("Bearer $token", requestBody)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@ChatRoomsActivity, "Room created!", Toast.LENGTH_SHORT)
                            .show()
                        inputUsername.setText("")
                        loadChatRooms()
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown error"
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            "Failed: $errorMsg",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun loadChatRooms() {
        ApiClient.apiService.getChatRooms("Bearer $token")
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(
                    call: Call<List<ChatRoom>>,
                    response: Response<List<ChatRoom>>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val rooms = response.body()!!

                        chatRoomAdapter = ChatRoomAdapter(currentUserId) { selectedRoom ->
                            val intent = Intent(this@ChatRoomsActivity, ChatActivity::class.java).apply {
                                putExtra("roomId", selectedRoom._id)
                            }
                            startActivity(intent)
                        }

                        recyclerView.adapter = chatRoomAdapter
                        chatRoomAdapter.submitList(rooms) // ✅ required to show data

                    } else {
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            "Failed to load rooms",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        "Error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
