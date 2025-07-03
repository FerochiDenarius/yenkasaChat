package com.example.yenkasachat.ui

import com.example.yenkasachat.util.NotificationHelper
import android.os.Bundle
import android.widget.*
import android.content.Context
import android.content.Intent
import android.provider.ContactsContract
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import com.google.android.gms.location.LocationServices
import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.database.Cursor
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChatActivity : AppCompatActivity(), ChatMessageHandler.ChatMessageCallback {

    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var attachMenu: LinearLayout
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var token: String
    private lateinit var senderId: String
    private lateinit var roomId: String
    private lateinit var handler: ChatMessageHandler
    private var lastMessageCount = 0

    private val uiHandler = Handler(Looper.getMainLooper())
    private val refreshInterval = 5000L

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { handler.uploadFileToCloudinary(it, "image") }
    }

    private val audioPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { handler.uploadFileToCloudinary(it, "audio") }
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { handler.uploadFileToCloudinary(it, "file") }
    }

    private val contactPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val uri = it.data?.data ?: return@registerForActivityResult
        val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
        cursor?.use { cur ->
            val nameIndex = cur.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
            val name = if (nameIndex != -1 && cur.moveToFirst()) cur.getString(nameIndex) else "Unknown"
            handler.sendMessage(mapOf("contactInfo" to name))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        messagesRecyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.buttonSend)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
        attachMenu = findViewById(R.id.attachmentMenu)

        val attachImageButton: ImageButton = findViewById(R.id.buttonAttachImage)
        val attachAudioButton: ImageButton = findViewById(R.id.buttonAttachAudio)
        val attachLocationButton: ImageButton = findViewById(R.id.buttonAttachLocation)
        val attachFileButton: ImageButton = findViewById(R.id.buttonAttachFile)
        val attachContactButton: ImageButton = findViewById(R.id.buttonAttachContact)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, "Missing token, roomId or userId", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        handler = ChatMessageHandler(this, this, token, senderId, roomId)

        messageAdapter = MessageAdapter(senderId)
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = messageAdapter

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                handler.sendMessage(mapOf("text" to text))
                messageInput.text.clear()
            }
        }

        attachButton.setOnClickListener {
            attachMenu.visibility = if (attachMenu.visibility == LinearLayout.GONE) LinearLayout.VISIBLE else LinearLayout.GONE
        }

        attachImageButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            imagePickerLauncher.launch("image/*")
        }

        attachAudioButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            audioPickerLauncher.launch("audio/*")
        }

        attachFileButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            filePickerLauncher.launch("*/*")
        }

        attachLocationButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            handler.sendLocation()
        }

        attachContactButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
            contactPickerLauncher.launch(intent)
        }

        fetchMessages()
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                fetchMessages()
                uiHandler.postDelayed(this, refreshInterval)
            }
        }, refreshInterval)
    }

    override fun onDestroy() {
        super.onDestroy()
        uiHandler.removeCallbacksAndMessages(null)
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId).enqueue(object : Callback<List<ChatMessage>> {
            override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                val messages = response.body()
                if (response.isSuccessful && messages != null) {
                    // Trigger notification if there is a new message and it's not from the sender
                    if (messages.size > lastMessageCount) {
                        val newMessages = messages.subList(lastMessageCount, messages.size)
                        val incomingMessages = newMessages.filter { it.senderId != senderId }

                        if (incomingMessages.isNotEmpty()) {
                            val latest = incomingMessages.last()
                            NotificationHelper.showMessageNotification(
                                this@ChatActivity,
                                latest.senderId ?: "Unknown",
                                latest.text ?: "New message"
                            )
                        }
                    }

                    lastMessageCount = messages.size
                    messageAdapter.submitList(messages.toList())
                    messagesRecyclerView.scrollToPosition(messages.size - 1)
                } else {
                    Log.e("FetchMessages", "Failed: ${response.code()}")
                }
            }

            override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                Log.e("FetchMessages", "Error: ${t.message}")
            }
        })
    }


    override fun onMessageSent(message: ChatMessage) {
        val updated = messageAdapter.currentList.toMutableList()
        updated.add(message)
        messageAdapter.submitList(updated)
        messagesRecyclerView.scrollToPosition(updated.size - 1)
    }

    override fun onError(error: String) {
        Toast.makeText(this, error, Toast.LENGTH_SHORT).show()
    }
}
