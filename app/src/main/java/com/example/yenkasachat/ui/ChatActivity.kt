package com.example.yenkasachat.ui

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.EditText
import android.widget.ImageButton
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response


class ChatActivity : AppCompatActivity() {

    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var roomId: String
    private lateinit var senderId: String
    private lateinit var token: String
    private val handler = Handler(Looper.getMainLooper())
    private val refreshInterval = 5000L // 5 seconds

    private val messagePollingRunnable = object : Runnable {
        override fun run() {
            fetchMessages()
            handler.postDelayed(this, refreshInterval)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        // Load from SharedPreferences
        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""

        // Load from intent
        roomId = intent.getStringExtra("roomId") ?: ""

        if (roomId.isEmpty() || senderId.isEmpty() || token.isEmpty()) {
            Toast.makeText(this, "Missing chat data or not logged in", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Setup UI
        messagesRecyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.buttonSend)

        messageAdapter = MessageAdapter(senderId)
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = messageAdapter

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                sendMessage(text)
            }
        }

        fetchMessages()
        handler.postDelayed(messagePollingRunnable, refreshInterval)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(messagePollingRunnable)
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
            override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                if (response.isSuccessful && response.body() != null) {
                    val newMessages = response.body() ?: emptyList()
                    val lastVisible = (messagesRecyclerView.layoutManager as LinearLayoutManager)
                        .findLastCompletelyVisibleItemPosition()
                    val isAtBottom = lastVisible == messageAdapter.itemCount - 1

                    messageAdapter.submitList(newMessages)

                    if (isAtBottom || messageAdapter.itemCount == 0) {
                        messagesRecyclerView.scrollToPosition(newMessages.size - 1)
                    }
                } else {
                    Toast.makeText(this@ChatActivity, "Failed to load messages", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                Toast.makeText(this@ChatActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }


    private fun sendMessage(text: String) {
        val request = mapOf(
            "roomId" to roomId,
            "senderId" to senderId,
            "text" to text
        )

        ApiClient.apiService.sendMessage("Bearer $token", request).enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful && response.body() != null) {
                    val newMessage = response.body()!!
                    val updatedMessages = messageAdapter.currentList.toMutableList()
                    updatedMessages.add(newMessage)
                    messageAdapter.submitList(updatedMessages)
                    messagesRecyclerView.scrollToPosition(updatedMessages.size - 1)
                    messageInput.text.clear()
                } else {
                    Toast.makeText(this@ChatActivity, "Failed to send message", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Toast.makeText(this@ChatActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }
}
