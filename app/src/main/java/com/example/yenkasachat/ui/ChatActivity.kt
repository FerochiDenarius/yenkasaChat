package com.example.yenkasachat.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog // Corrected Import
import androidx.appcompat.app.AppCompatActivity
// Removed: androidx.compose.ui.semantics.dismiss - Not used here
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.util.TokenManager
import com.google.android.gms.location.LocationServices
import java.io.File
import java.io.IOException
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class ChatActivity : AppCompatActivity(),
    ChatMessageHandler.ChatMessageCallback,    // For ChatMessageHandler
    MessageAdapter.OnMessageLongClickListener, // For RecyclerView Adapter
    ChatHelperCallback {                       // For ChatActivityHelper

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

    private lateinit var chatMessageHandler: ChatMessageHandler
    private lateinit var messageActionHandler: MessageActionHandler
    private lateinit var chatActivityHelper: ChatActivityHelper

    private lateinit var tempCameraUri: Uri
    private val uiHandler = Handler(Looper.getMainLooper())

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success && ::tempCameraUri.isInitialized) {
            chatMessageHandler.uploadFileToCloudinary(tempCameraUri, "image")
        } else {
            if (!success) Toast.makeText(this, "Camera capture failed or cancelled.", Toast.LENGTH_SHORT).show()
        }
    }

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { chatMessageHandler.uploadFileToCloudinary(it, "image") }
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { chatMessageHandler.uploadFileToCloudinary(it, "file") }
    }

    private val contactPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.data?.let { uri ->
            chatActivityHelper.handleContactPickerResult(uri, contentResolver)
        }
    }

    private val audioRecLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        result.data?.getStringExtra("audio_uri")?.let { uriString ->
            chatMessageHandler.checkAndUploadAudio(Uri.parse(uriString))
        }
    }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        chatActivityHelper.handlePermissionsResult(permissions)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        initViews() // Initialize basic views like RecyclerView, EditText, etc.

        // This is the critical validation step
        if (!retrieveSessionAndValidate()) {
            // If retrieveSessionAndValidate() returns false (e.g., roomId is blank):
            // 1. A Toast is shown.
            // 2. An error is logged.
            // 3. finish() is called on this Activity.
            // 4. THIS 'return' STATEMENT IS EXECUTED.
            return // <--- Execution of onCreate STOPS HERE.
        }

        // --- THE CODE BELOW THIS LINE ONLY EXECUTES IF retrieveSessionAndValidate() RETURNED true ---
        // --- This means 'token', 'senderId', and 'roomId' are considered valid at this point. ---

        // Initialize ChatMessageHandler (depends on token, senderId, roomId)
        chatMessageHandler = ChatMessageHandler(this, this, token, senderId, roomId)

        // Initialize FusedLocationProviderClient
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        // Initialize MessageAdapter (depends on senderId)
        messageAdapter = MessageAdapter(senderId)
        messageAdapter.setOnMessageLongClickListener(this)

        // Initialize ChatActivityHelper (depends on token, senderId, roomId, etc.)
        // This is the lateinit var that was causing the crash in onDestroy
        chatActivityHelper = ChatActivityHelper(
            applicationContext,
            this,
            token,
            senderId,
            roomId,
            fusedLocationClient,
            uiHandler
        )

        // Initialize MessageActionHandler (depends on senderId, chatActivityHelper)
        messageActionHandler = MessageActionHandler(this, senderId, chatActivityHelper)

        // Setup UI and start operations that might use the initialized helpers
        setupChatRecyclerView()
        setupListeners()

        // This call relies on chatActivityHelper being initialized
        chatActivityHelper.startFetchingMessagesRepeatedly()
        requestNeededPermissions() // This might also indirectly use chatActivityHelper
    }


    override fun onDestroy() {
        super.onDestroy()
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.stopFetchingMessages()
        }
        uiHandler.removeCallbacksAndMessages(null)
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
        findViewById<ImageButton>(R.id.buttonAttachImage).setOnClickListener {
            attachMenu.visibility = View.GONE
            imagePickerLauncher.launch("image/*")
        }
        findViewById<ImageButton>(R.id.buttonAttachCamera).setOnClickListener {
            attachMenu.visibility = View.GONE
            try {
                val photoFile = File.createTempFile("camera_photo_${System.currentTimeMillis()}", ".jpg", cacheDir).apply {
                    deleteOnExit()
                }
                tempCameraUri = FileProvider.getUriForFile(this, "${applicationContext.packageName}.provider", photoFile)
                cameraLauncher.launch(tempCameraUri)
            } catch (ex: IOException) {
                Log.e("ChatActivity", "Error creating temp file for camera", ex)
                Toast.makeText(this, "Could not start camera: error creating image file.", Toast.LENGTH_LONG).show()
            }
        }
        findViewById<ImageButton>(R.id.buttonAttachLocation).setOnClickListener {
            attachMenu.visibility = View.GONE
            chatActivityHelper.sendCurrentLocation()
        }
        findViewById<ImageButton>(R.id.buttonAttachFile).setOnClickListener {
            attachMenu.visibility = View.GONE
            filePickerLauncher.launch("*/*")
        }
        findViewById<ImageButton>(R.id.buttonAttachContact).setOnClickListener {
            attachMenu.visibility = View.GONE
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
            contactPickerLauncher.launch(intent)
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
                chatMessageHandler.sendMessage(mapOf("text" to text))
                messageInput.setText("")
                hideKeyboard()
            }
        }

        micButton.setOnClickListener {
            if (checkAndRequestPermission(Manifest.permission.RECORD_AUDIO)) {
                val intent = Intent(this, AudioRecActivity::class.java)
                audioRecLauncher.launch(intent)
            } else {
                Toast.makeText(this, "Audio recording permission needed.", Toast.LENGTH_SHORT).show()
            }
        }

        attachButton.setOnClickListener {
            if (attachMenu.visibility == View.GONE) {
                hideKeyboard()
            }
            attachMenu.visibility = if (attachMenu.visibility == View.GONE) View.VISIBLE else View.GONE
        }
    }

    private fun setupChatRecyclerView() {
        recyclerView.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        recyclerView.adapter = messageAdapter
    }

    private fun retrieveSessionAndValidate(): Boolean {
        token = TokenManager.getToken(this) ?: ""
        senderId = TokenManager.getUserId(this) ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            val missingData = listOfNotNull(
                "Auth Token".takeIf { token.isBlank() },
                "User ID".takeIf { senderId.isBlank() },
                "Room ID".takeIf { roomId.isBlank() }
            ).joinToString()
            Toast.makeText(this, "Cannot open chat. Missing data: $missingData.", Toast.LENGTH_LONG).show()
            Log.e("ChatActivity", "Session validation failed. Missing: $missingData")
            finish()
            return false
        }
        return true
    }

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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    // --- ChatMessageHandler.ChatMessageCallback Implementation ---
    override fun onMessageSent(message: ChatMessage) {
        chatActivityHelper.onMessageSentByHandler(message)
    }

    override fun onError(error: String) {
        chatActivityHelper.onErrorFromHandler(error)
    }

    // --- MessageAdapter.OnMessageLongClickListener Implementation ---
    override fun onMessageLongClicked(message: ChatMessage, itemView: View, position: Int): Boolean {
        Log.d("ChatActivity", "Long clicked message: '${message.text ?: "Media Message"}'")
        messageActionHandler.showPopupMenu(message, itemView, position)
        return true
    }

    // --- ChatHelperCallback Implementation ---
    override fun showToast(message: String, length: Int) {
        Toast.makeText(this, message, length).show()
    }

    override fun updateMessages(messages: List<ChatMessage>) {
        messageAdapter.submitList(messages.toList()) { // Use .toList() for new list instance
            if (messages.isNotEmpty()) {
                val layoutManager = recyclerView.layoutManager as LinearLayoutManager
                val lastVisibleItemPosition = layoutManager.findLastVisibleItemPosition()
                if (lastVisibleItemPosition == RecyclerView.NO_POSITION || lastVisibleItemPosition >= messages.size - 2 || messages.size <=1) {
                    recyclerView.smoothScrollToPosition(messages.size - 1)
                }
            }
        }
    }

    override fun getCurrentMessageList(): List<ChatMessage> {
        return messageAdapter.currentList
    }

    override fun requestHideKeyboard() {
        hideKeyboard()
    }

    override fun requestSendChatMessage(messageData: Map<String, Any>) {
        chatMessageHandler.sendMessage(messageData)
    }

    override fun checkAndRequestPermission(permission: String): Boolean {
        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
            permissionsLauncher.launch(arrayOf(permission))
            return false
        }
        return true
    }

    override fun requestDeleteConfirmation(messageToDelete: ChatMessage) {
        AlertDialog.Builder(this)
            .setTitle("Delete Message")
            .setMessage("Are you sure you want to delete this message?\n\"${messageToDelete.text ?: "Media Message"}\"")
            .setPositiveButton("Delete") { dialog, _ ->
                // Launch a coroutine here using lifecycleScope
                lifecycleScope.launch {
                    chatActivityHelper.confirmDeleteMessageOnServer(messageToDelete)
                }
                dialog.dismiss()
            }
            .setNegativeButton("Cancel") { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }
    // --- Utility Methods specific to ChatActivity ---
    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        var view = currentFocus
        if (view == null) {
            view = View(this)
        }
        imm.hideSoftInputFromWindow(view.windowToken, 0)
    }
}
