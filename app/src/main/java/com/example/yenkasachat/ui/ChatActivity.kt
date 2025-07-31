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
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage // Ensure this is importing your correct ChatMessage model
// import com.example.yenkasachat.model.PushNotificationRequest // Not used directly in this snippet
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.NotificationHelper
import com.example.yenkasachat.util.SharedPrefs
// import com.example.yenkasachat.util.TokenManager
import com.google.android.gms.location.LocationServices
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException

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
    private var recipientPlayerId: String = ""
    private val uiHandler = Handler(Looper.getMainLooper())
    private var lastMessageTimestamp: Long = 0L
    private val refreshInterval = 5000L
    private lateinit var tempCameraUri: Uri

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && ::tempCameraUri.isInitialized) {
            handler.uploadFileToCloudinary(tempCameraUri, "image")
        } else {
            if (!success) Toast.makeText(this, "Camera capture failed or cancelled.", Toast.LENGTH_SHORT).show()
        }
    }

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { handler.uploadFileToCloudinary(it, "image") }
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { handler.uploadFileToCloudinary(it, "file") }
    }

    private val contactPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.data?.let { uri ->
            val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
            cursor?.use { cur ->
                if (cur.moveToFirst()) {
                    val nameIndex = cur.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
                    val name = if (nameIndex != -1) cur.getString(nameIndex) else "Unknown Contact"
                    handler.sendMessage(mapOf("contactInfo" to name))
                }
            }
        }
    }

    private val audioRecLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.getStringExtra("audio_uri")?.let { uriString ->
            handler.checkAndUploadAudio(Uri.parse(uriString))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        initViews()
        setupListeners()
        if (!retrieveSessionAndValidate()) {
            return
        }

        recipientPlayerId = intent.getStringExtra("recipientPlayerId") ?: ""
        if (recipientPlayerId.isBlank()) {
            Log.w("ChatActivity", "⚠️ RecipientPlayerId not passed in intent. Push notifications to this user might not work directly from here.")
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

        sendButton.visibility = if (messageInput.text.isNullOrBlank()) View.GONE else View.VISIBLE
        micButton.visibility = if (messageInput.text.isNullOrBlank()) View.VISIBLE else View.GONE
    }

    private fun setupListeners() {
        val btnImage: ImageButton = findViewById(R.id.buttonAttachImage)
        val btnCamera: ImageButton = findViewById(R.id.buttonAttachCamera)
        val btnLocation: ImageButton = findViewById(R.id.buttonAttachLocation)
        val btnFile: ImageButton = findViewById(R.id.buttonAttachFile)
        val btnContact: ImageButton = findViewById(R.id.buttonAttachContact)

        btnCamera.setOnClickListener {
            attachMenu.visibility = View.GONE
            try {
                val photoFile = File.createTempFile("camera_photo_${System.currentTimeMillis()}", ".jpg", cacheDir).apply {
                    deleteOnExit()
                }
                tempCameraUri = FileProvider.getUriForFile(
                    this,
                    "${applicationContext.packageName}.provider",
                    photoFile
                )
                grantUriPermission("com.android.camera", tempCameraUri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                cameraLauncher.launch(tempCameraUri)
            } catch (ex: IOException) {
                Log.e("ChatActivity", "Error creating temp file for camera", ex)
                Toast.makeText(this, "Could not start camera: error creating image file.", Toast.LENGTH_LONG).show()
            }
        }

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
                // hideKeyboard()
            }
        }

        micButton.setOnClickListener {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                val intent = Intent(this, AudioRecActivity::class.java)
                audioRecLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Audio recording permission needed.", Toast.LENGTH_SHORT).show()
                requestPermissions()
            }
        }

        attachButton.setOnClickListener {
            if (attachMenu.visibility == View.GONE) {
                hideKeyboard()
            }
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

    private fun retrieveSessionAndValidate(): Boolean {
        token = SharedPrefs.getToken(this) ?: ""
        senderId = SharedPrefs.getUserId(this) ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            var errorMessage = "Missing required data: "
            if (token.isBlank()) errorMessage += "Auth Token, "
            if (senderId.isBlank()) errorMessage += "User ID, "
            if (roomId.isBlank()) errorMessage += "Room ID"
            errorMessage = errorMessage.trimEnd(',', ' ') + "."

            Log.e("ChatActivity", errorMessage)
            Toast.makeText(this, "Cannot open chat. $errorMessage Please try again.", Toast.LENGTH_LONG).show()
            finish()
            return false
        }
        return true
    }

    private fun setupChat() {
        handler = ChatMessageHandler(this, this, token, senderId, roomId)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        messageAdapter = MessageAdapter(senderId)
        recyclerView.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        recyclerView.adapter = messageAdapter
    }

    private fun sendCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
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
                    Toast.makeText(this, "Location sent", Toast.LENGTH_SHORT).show()
                } ?: Toast.makeText(this, "Could not get current location. Ensure location services are enabled.", Toast.LENGTH_LONG).show()
            }.addOnFailureListener { e ->
                Log.e("ChatActivity", "Failed to get location", e)
                Toast.makeText(this, "Failed to get location: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "Location permission needed to share location.", Toast.LENGTH_SHORT).show()
            requestPermissions()
        }
    }

    private fun fetchMessagesRepeatedly() {
        fetchMessages()
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                if (isActive()) {
                    fetchMessages()
                    uiHandler.postDelayed(this, refreshInterval)
                }
            }
        }, refreshInterval)
    }

    private fun fetchMessages() {
        if (roomId.isBlank()) {
            Log.e("FetchMessages", "Room ID is blank, cannot fetch messages.")
            return
        }

// Inside ChatActivity.kt, in the fetchMessages() function

// Ensure 'roomId' (the class member variable) has been correctly initialized
// by the time this function is called.
// You do this in retrieveSessionAndValidate()

        if (roomId.isBlank()) { // Good practice to check this before making the call
            Log.e("FetchMessages", "Room ID is blank, cannot fetch messages.")
            // Optionally show a toast or handle this error more gracefully
            // Toast.makeText(this, "Room ID is missing, cannot fetch messages.", Toast.LENGTH_SHORT).show()
            return // Don't proceed if roomId is blank
        }

// Pass the class member 'roomId' to the getMessages function
        ApiClient.apiService.getMessages(roomId = this.roomId) // Pass the roomId
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    if (response.isSuccessful) {
                        val messages = response.body()
                        if (messages != null) {
                            val newMessages = messages.filter { (it.timestamp?.toLongOrNull() ?: 0L) > lastMessageTimestamp }
                            if (newMessages.isNotEmpty()) {
                                newMessages.lastOrNull()?.let { lastNewMsg ->
                                    if (lastNewMsg.senderId != senderId) { // Ensure senderId is also correctly initialized
                                        NotificationHelper.showMessageNotification(
                                            this@ChatActivity,
                                            lastNewMsg.senderId ?: "Someone",
                                            lastNewMsg.text ?: lastNewMsg.imageUrl ?: lastNewMsg.fileUrl ?: lastNewMsg.contactInfo ?: "New message"
                                        )
                                    }
                                    lastMessageTimestamp = lastNewMsg.timestamp?.toLongOrNull() ?: lastMessageTimestamp
                                }
                                messageAdapter.submitList(messages.toList()) {
                                    if (messages.isNotEmpty()) {
                                        recyclerView.smoothScrollToPosition(messages.size - 1)
                                    }
                                }
                            } else if (messageAdapter.currentList.isEmpty() && messages.isNotEmpty()){
                                messageAdapter.submitList(messages.toList()) {
                                    if (messages.isNotEmpty()) {
                                        recyclerView.smoothScrollToPosition(messages.size - 1)
                                    }
                                }
                                messages.lastOrNull()?.let {
                                    lastMessageTimestamp = it.timestamp?.toLongOrNull() ?: lastMessageTimestamp
                                }
                            } else if (messageAdapter.currentList.size != messages.size && messages.isNotEmpty()) {
                                messageAdapter.submitList(messages.toList())
                                // Optionally scroll
                                // recyclerView.smoothScrollToPosition(messages.size - 1)
                            }
                        } else {
                            Log.d("FetchMessages", "Response successful but message list is null.")
                        }
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("FetchMessages", "Failed to fetch messages: $errorMsg (Code: ${response.code()})")
                        // Propagate error to UI if needed
                        // Toast.makeText(this@ChatActivity, "Failed to fetch: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                    Log.e("FetchMessages", "Error fetching messages: ${t.message}", t)
                    if (isActive()) {
                        Toast.makeText(this@ChatActivity, "Couldn't refresh messages: ${t.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            })
    }

    private fun isActive(): Boolean {
        return !isFinishing && !isDestroyed
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == false) {
            Toast.makeText(this, "Location permission denied. Sharing location is disabled.", Toast.LENGTH_LONG).show()
        }
        if (permissions[Manifest.permission.RECORD_AUDIO] == false) {
            Toast.makeText(this, "Audio recording permission denied. Sending voice messages is disabled.", Toast.LENGTH_LONG).show()
        }
        if (permissions[Manifest.permission.CAMERA] == false) {
            Toast.makeText(this, "Camera permission denied. Taking photos is disabled.", Toast.LENGTH_LONG).show()
        }
    }

    private fun requestPermissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (permissionsToRequest.isNotEmpty()) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        uiHandler.removeCallbacksAndMessages(null)
        if (::handler.isInitialized) {
            // handler.cleanup() // If your ChatMessageHandler has a cleanup method
        }
    }

    // Callback from ChatMessageHandler when a message (usually sent by current user) is confirmed or needs UI update
    override fun onMessageSent(message: ChatMessage) {
        val currentMessages = messageAdapter.currentList.toMutableList()

        // Use 'messageId' as per your ChatMessage.kt model.
        // Since 'localId' is not in your model, we only check for messageId.
        val alreadyExists = currentMessages.any {
            // Only compare if the message from the server has a messageId
            message.messageId != null && it.messageId == message.messageId
        }

        if (!alreadyExists) {
            currentMessages.add(message)
            // Submit a new list to DiffUtil
            messageAdapter.submitList(currentMessages.toList()) {
                // Ensure scrolling happens after list is updated
                if (currentMessages.isNotEmpty()) {
                    recyclerView.smoothScrollToPosition(currentMessages.size - 1)
                }
            }
            // Update lastMessageTimestamp if this is the newest message
            val messageTs = message.timestamp?.toLongOrNull() ?: 0L
            if (messageTs > lastMessageTimestamp) {
                lastMessageTimestamp = messageTs
            }
        }
    }

    override fun onError(error: String) {
        if (isActive()) {
            Toast.makeText(this, "Error: $error", Toast.LENGTH_LONG).show()
            Log.e("ChatActivity", "ChatMessageHandler Error: $error")
        }
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        var view = currentFocus
        if (view == null) {
            view = View(this)
        }
        imm.hideSoftInputFromWindow(view.windowToken, 0)
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string() ?: "Unknown error (empty error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
