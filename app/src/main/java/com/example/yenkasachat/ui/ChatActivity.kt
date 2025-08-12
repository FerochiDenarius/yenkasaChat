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
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.NotificationHelper
import com.example.yenkasachat.util.TokenManager
import com.google.android.gms.location.LocationServices
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException

// This is the updated ChatActivity.kt file with improvements for notification handling
// and permission requests.
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

    // --- Activity Result Launchers ---
    // These remain the same as your original code, as they are not the source of the issue.
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

    // --- Permission Launchers ---
    // The main change here is adding the POST_NOTIFICATIONS permission request
    // and handling the different permission results.
    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Check for specific permissions
        if (permissions[Manifest.permission.ACCESS_FINE_LOCATION] == false) {
            Toast.makeText(this, "Location permission denied. Sharing location is disabled.", Toast.LENGTH_LONG).show()
        }
        if (permissions[Manifest.permission.RECORD_AUDIO] == false) {
            Toast.makeText(this, "Audio recording permission denied. Sending voice messages is disabled.", Toast.LENGTH_LONG).show()
        }
        if (permissions[Manifest.permission.CAMERA] == false) {
            Toast.makeText(this, "Camera permission denied. Taking photos is disabled.", Toast.LENGTH_LONG).show()
        }
        // This is the critical new part: checking for the notification permission.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (permissions[Manifest.permission.POST_NOTIFICATIONS] == false) {
                Toast.makeText(this, "Notification permission denied. You will not receive new message alerts.", Toast.LENGTH_LONG).show()
            }
        }
    }

    // --- Lifecycle Methods ---
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
        // Call the new permission request function
        requestNeededPermissions()
    }

    // This method is called to ensure permissions are requested
    private fun requestNeededPermissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        // Add the POST_NOTIFICATIONS permission for Android 13 (API 33) and above
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
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
        // ... (Listeners are unchanged, so they are omitted for brevity) ...
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
                hideKeyboard()
            }
        }

        micButton.setOnClickListener {
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                val intent = Intent(this, AudioRecActivity::class.java)
                audioRecLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Audio recording permission needed.", Toast.LENGTH_SHORT).show()
                requestNeededPermissions()
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
        token = TokenManager.getToken(this) ?: ""
        senderId = TokenManager.getUserId(this) ?: ""
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
            requestNeededPermissions()
        }
    }

    private fun fetchMessagesRepeatedly() {
        fetchMessages()
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                // Check if the activity is still active and the user has not left
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

        // Call your API to get messages
        ApiClient.apiService.getMessages(roomId = this.roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    if (response.isSuccessful) {
                        val messages = response.body()
                        if (messages != null) {
                            // Filter for new messages based on timestamp
                            val newMessages = messages.filter { (it.timestamp?.toLongOrNull() ?: 0L) > lastMessageTimestamp }
                            if (newMessages.isNotEmpty()) {
                                // IMPORTANT: Your original code only checked the last new message.
                                // This loop ensures a notification is shown for ALL new messages from other users.
                                for (msg in newMessages) {
                                    // Make sure not to show a notification for the current user's own messages.
                                    if (msg.senderId != senderId) {
                                        // Check if notification permission is granted before showing
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                                            ContextCompat.checkSelfPermission(this@ChatActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                                            // The permission is not granted, so we can't show a notification.
                                            // We'll log a warning and skip it.
                                            Log.w("ChatActivity", "Notification permission not granted. Cannot show notification for new message from ${msg.senderId}.")
                                        } else {
                                            NotificationHelper.showMessageNotification(
                                                this@ChatActivity,
                                                msg.senderId ?: "Someone",
                                                msg.text ?: msg.imageUrl ?: msg.fileUrl ?: msg.contactInfo ?: "New message"
                                            )
                                        }
                                    }
                                }

                                // Update the last message timestamp to the newest message
                                newMessages.lastOrNull()?.let { lastNewMsg ->
                                    lastMessageTimestamp = lastNewMsg.timestamp?.toLongOrNull() ?: lastMessageTimestamp
                                }

                                // Update the RecyclerView
                                messageAdapter.submitList(messages.toList()) {
                                    if (messages.isNotEmpty()) {
                                        recyclerView.smoothScrollToPosition(messages.size - 1)
                                    }
                                }
                            } else if (messageAdapter.currentList.isEmpty() && messages.isNotEmpty()){
                                // ... (This part of the logic is unchanged)
                                messageAdapter.submitList(messages.toList()) {
                                    if (messages.isNotEmpty()) {
                                        recyclerView.smoothScrollToPosition(messages.size - 1)
                                    }
                                }
                                messages.lastOrNull()?.let {
                                    lastMessageTimestamp = it.timestamp?.toLongOrNull() ?: lastMessageTimestamp
                                }
                            } else if (messageAdapter.currentList.size != messages.size && messages.isNotEmpty()) {
                                // ... (This part of the logic is unchanged)
                                messageAdapter.submitList(messages.toList())
                            }
                        } else {
                            Log.d("FetchMessages", "Response successful but message list is null.")
                        }
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("FetchMessages", "Failed to fetch messages: $errorMsg (Code: ${response.code()})")
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

    override fun onDestroy() {
        super.onDestroy()
        uiHandler.removeCallbacksAndMessages(null)
    }

    override fun onMessageSent(message: ChatMessage) {
        val currentMessages = messageAdapter.currentList.toMutableList()
        val alreadyExists = currentMessages.any {
            message.messageId != null && it.messageId == message.messageId
        }

        if (!alreadyExists) {
            currentMessages.add(message)
            messageAdapter.submitList(currentMessages.toList()) {
                if (currentMessages.isNotEmpty()) {
                    recyclerView.smoothScrollToPosition(currentMessages.size - 1)
                }
            }
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
