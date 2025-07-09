package com.example.yenkasachat.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.location.Location
import android.net.Uri
import android.os.*
import android.provider.ContactsContract
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.NotificationHelper
import com.google.android.gms.location.LocationServices
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ChatActivity : AppCompatActivity(), ChatMessageHandler.ChatMessageCallback {

    private lateinit var recyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var micButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var attachMenu: LinearLayout
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var token: String
    private lateinit var senderId: String
    private lateinit var roomId: String
    private lateinit var handler: ChatMessageHandler
    private lateinit var fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient
    private val uiHandler = Handler(Looper.getMainLooper())
    private var lastMessageCount = 0
    private val refreshInterval = 5000L

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { handler.uploadFileToCloudinary(it, "image") }
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

    private val audioRecLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val uriString = result.data?.getStringExtra("audio_uri")
        uriString?.let { handler.checkAndUploadAudio(Uri.parse(it)) }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        initViews()
        setupListeners()
        retrieveSession()

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, "Missing auth data", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupChat()
        fetchMessagesRepeatedly()
        requestPermissions()
    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.btnSend)
        micButton = findViewById(R.id.btnMic)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
        attachMenu = findViewById(R.id.attachmentMenu)
    }

    private fun setupListeners() {
        val btnImage: ImageButton = findViewById(R.id.buttonAttachImage)
        val btnLocation: ImageButton = findViewById(R.id.buttonAttachLocation)
        val btnFile: ImageButton = findViewById(R.id.buttonAttachFile)
        val btnContact: ImageButton = findViewById(R.id.buttonAttachContact)

        messageInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                val hasText = !s.isNullOrBlank()
                sendButton.visibility = if (hasText) View.VISIBLE else View.GONE
                micButton.visibility = if (!hasText) View.VISIBLE else View.GONE
                messageInput.maxLines = if (hasText) 5 else 1
            }

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                handler.sendMessage(mapOf("text" to text))
                messageInput.setText("")
            }
        }

        micButton.setOnClickListener {
            val intent = Intent(this, AudioRecActivity::class.java)
            audioRecLauncher.launch(intent)
        }

        attachButton.setOnClickListener {
            attachMenu.visibility = if (attachMenu.visibility == View.GONE) View.VISIBLE else View.GONE
        }

        btnImage.setOnClickListener {
            attachMenu.visibility = View.GONE
            imagePickerLauncher.launch("image/*")
        }

        btnFile.setOnClickListener {
            attachMenu.visibility = View.GONE
            filePickerLauncher.launch("*/*")
        }

        btnLocation.setOnClickListener {
            attachMenu.visibility = View.GONE
            sendCurrentLocation()
        }

        btnContact.setOnClickListener {
            attachMenu.visibility = View.GONE
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
            contactPickerLauncher.launch(intent)
        }
    }

    private fun retrieveSession() {
        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""
    }

    private fun setupChat() {
        handler = ChatMessageHandler(this, this, token, senderId, roomId)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        messageAdapter = MessageAdapter(senderId)
        recyclerView.layoutManager = LinearLayoutManager(this)
        recyclerView.adapter = messageAdapter
    }

    private fun sendCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        ) {
            fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                location?.let {
                    handler.sendMessage(
                        mapOf(
                            "location" to mapOf(
                                "latitude" to it.latitude,
                                "longitude" to it.longitude
                            )
                        )
                    )
                } ?: Toast.makeText(this, "Location not available", Toast.LENGTH_SHORT).show()
            }.addOnFailureListener {
                Toast.makeText(this, "Failed to get location", Toast.LENGTH_SHORT).show()
            }
        } else {
            requestPermissions()
        }
    }

    private fun fetchMessagesRepeatedly() {
        fetchMessages()
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                fetchMessages()
                uiHandler.postDelayed(this, refreshInterval)
            }
        }, refreshInterval)
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    val messages = response.body()
                    if (response.isSuccessful && messages != null) {
                        if (messages.size > lastMessageCount) {
                            val newMessages = messages.subList(lastMessageCount, messages.size)
                            val incomingMessages = newMessages.filter { it.senderId != senderId }
                            incomingMessages.lastOrNull()?.let {
                                NotificationHelper.showMessageNotification(
                                    this@ChatActivity,
                                    it.senderId ?: "Unknown",
                                    it.text ?: "New message"
                                )
                            }
                        }
                        lastMessageCount = messages.size
                        messageAdapter.submitList(messages.toList())
                        recyclerView.scrollToPosition(messages.size - 1)
                    } else {
                        Log.e("FetchMessages", "Failed: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                    Log.e("FetchMessages", "Error: ${t.message}")
                }
            })
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (!(permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false)) {
            Toast.makeText(this, "Location permission not granted", Toast.LENGTH_SHORT).show()
        }
        if (!(permissions[Manifest.permission.RECORD_AUDIO] ?: false)) {
            Toast.makeText(this, "Audio permission not granted", Toast.LENGTH_SHORT).show()
        }
    }

    private fun requestPermissions() {
        val permissions = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) permissions.add(Manifest.permission.RECORD_AUDIO)

        if (permissions.isNotEmpty()) {
            permissionsLauncher.launch(permissions.toTypedArray())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        uiHandler.removeCallbacksAndMessages(null)
    }

    override fun onMessageSent(message: ChatMessage) {
        val updated = messageAdapter.currentList.toMutableList()
        updated.add(message)
        messageAdapter.submitList(updated)
        recyclerView.scrollToPosition(updated.size - 1)
    }

    override fun onError(error: String) {
        Toast.makeText(this, error, Toast.LENGTH_SHORT).show()
    }
}
