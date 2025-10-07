package com.example.yenkasachat.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
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
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.MessageAdapter
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.Participant
import com.example.yenkasachat.util.TokenManager
import com.google.android.gms.location.LocationServices
import de.hdodenhof.circleimageview.CircleImageView
import kotlinx.coroutines.launch
import java.io.File
import java.io.IOException

class ChatActivity : AppCompatActivity(), ChatHelperCallback, ChatMessageHandler.ChatMessageCallback, MessageAdapter.OnMessageLongClickListener {

    private lateinit var recyclerView: RecyclerView
    private lateinit var messageInput: RichContentEditText
    private lateinit var sendButton: ImageButton
    private lateinit var micButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var attachMenu: LinearLayout

    private lateinit var textViewReceiverName: TextView
    private lateinit var imageViewReceiverPicture: CircleImageView
    private lateinit var imageViewStatusIndicator: ImageView
    private lateinit var textViewOnlineStatus: TextView

    // Reply Views
    private lateinit var replyPreviewLayout: RelativeLayout
    private lateinit var textViewRepliedToName: TextView
    private lateinit var textViewRepliedToMessage: TextView
    private lateinit var buttonCancelReply: ImageButton

    private lateinit var messageAdapter: MessageAdapter
    private lateinit var chatMessageHandler: ChatMessageHandler
    private lateinit var chatActivityHelper: ChatActivityHelper
    private lateinit var messageActionHandler: MessageActionHandler

    private var token: String = ""
    private var senderId: String = ""
    private var roomId: String? = null
    private var tempCameraUri: Uri? = null
    private var replyingToMessage: ChatMessage? = null

    private val uiHandler = Handler(Looper.getMainLooper())

    // --- Activity Result Launchers ---
    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { chatMessageHandler.uploadFileToCloudinary(it, "image") }
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            tempCameraUri?.let { chatMessageHandler.uploadFileToCloudinary(it, "image") }
        }
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
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

        initViews()

        if (!retrieveSessionAndValidate()) {
            return // Exit if session is not valid
        }

        // Safe to use non-null assertion here because retrieveSessionAndValidate ensures they are not null.
        chatMessageHandler = ChatMessageHandler(this, this, token, senderId, roomId!!)
        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        messageAdapter = MessageAdapter(senderId)
        messageAdapter.setOnMessageLongClickListener(this)

        chatActivityHelper = ChatActivityHelper(
            applicationContext,
            this, // '''this''' is a valid ChatHelperCallback
            token,
            senderId,
            roomId!!, // Use non-null roomId
            fusedLocationClient,
            uiHandler
        )

        messageActionHandler = MessageActionHandler(this, senderId, chatActivityHelper)

        setupChatRecyclerView()
        setupListeners()

        chatActivityHelper.initializeHeaderInformation()
        chatActivityHelper.startFetchingMessagesRepeatedly()
        requestNeededPermissions()
    }

    override fun onDestroy() {
        super.onDestroy()
        chatActivityHelper.stopFetchingMessages()
        uiHandler.removeCallbacksAndMessages(null)
    }

    private fun initViews() {
        recyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.btnSend)
        micButton = findViewById(R.id.btnMic)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
        attachMenu = findViewById(R.id.attachmentMenu)

        textViewReceiverName = findViewById(R.id.textViewReceiverName)
        imageViewReceiverPicture = findViewById(R.id.imageViewReceiverPicture)
        imageViewStatusIndicator = findViewById(R.id.imageViewStatusIndicator)
        textViewOnlineStatus = findViewById(R.id.textViewOnlineStatus)

        // Reply views
        replyPreviewLayout = findViewById(R.id.replyPreviewLayout)
        textViewRepliedToName = findViewById(R.id.textViewRepliedToName)
        textViewRepliedToMessage = findViewById(R.id.textViewRepliedToMessage)
        buttonCancelReply = findViewById(R.id.buttonCancelReply)

        sendButton.visibility = if (messageInput.text.isNullOrBlank()) View.GONE else View.VISIBLE
        micButton.visibility = if (messageInput.text.isNullOrBlank()) View.VISIBLE else View.GONE
    }

    private fun setupListeners() {
        findViewById<ImageView>(R.id.imageViewBackButton).setOnClickListener { finish() }

        buttonCancelReply.setOnClickListener { clearReplyingTo() }

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


// In setupListeners()
        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()

            // The send button is only visible if text is not empty, so this check is sufficient.
            if (text.isNotEmpty()) {
                // 1. Create the data map with the text.
                val messageData = mutableMapOf<String, Any>("text" to text)

                // 2. If we are in reply mode, add the ID of the message being replied to.
                replyingToMessage?.let { message ->
                    // ✅ USE 'id' which is the correct field name from your ChatMessage model.
                    message.id?.let { repliedToId ->
                        messageData["repliedTo"] = repliedToId
                        Log.d("ChatActivity", "Attaching repliedTo ID: $repliedToId to message.")
                    }
                }

                // 3. Send the complete data package.
                chatMessageHandler.sendMessage(messageData)

                // 4. Reset the UI.
                messageInput.setText("")
                clearReplyingTo()
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

        // ✅ THIS IS THE CORRECT PLACE FOR THE NEW LISTENER
        // This listens for content (like stickers) coming from the keyboard.
        messageInput.onRichContentListener = { contentUri ->
            // The URI we get is a temporary content URI from the keyboard.
            // We can treat it just like an image picked from the gallery.
            Log.d("ChatActivity", "Sticker received with URI: $contentUri")

            // Use your existing handler to upload it as an "image"
            chatMessageHandler.uploadFileToCloudinary(contentUri, "image")
        }
    }

    private fun setupChatRecyclerView() {
        recyclerView.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        recyclerView.adapter = messageAdapter

        val swipeToReplyCallback = SwipeToReplyCallback(this) { viewHolder: RecyclerView.ViewHolder ->
            val position = viewHolder.adapterPosition
            if (position != RecyclerView.NO_POSITION) {
                val message = messageAdapter.currentList[position]
                showReplyPreview(message)
            }
        }

        val itemTouchHelper = ItemTouchHelper(swipeToReplyCallback)
        itemTouchHelper.attachToRecyclerView(recyclerView)
    }

// In ChatActivity.kt...

    private fun showReplyPreview(message: ChatMessage) {
        replyingToMessage = message // Store the message object for when we send
        replyPreviewLayout.visibility = View.VISIBLE

        // --- ✅ IMPROVED LOGIC STARTS HERE ---

        // 1. Determine the sender's name for the preview
        // Your 'sender' object might be null if the message comes from a socket event
        // without full population, so we fall back to senderId.
        val isMyMessage = message.sender?._id == senderId || message.senderId == senderId
        val senderName = if (isMyMessage) "You" else textViewReceiverName.text.toString()
        textViewRepliedToName.text = "Replying to $senderName"

        // 2. Create a rich summary of the message content
        val messageContent = when {
            !message.text.isNullOrBlank() -> message.text
            !message.imageUrl.isNullOrBlank() -> "📷 Image"
            !message.videoUrl.isNullOrBlank() -> "🎥 Video"
            !message.audioUrl.isNullOrBlank() -> "🎵 Audio"
            !message.fileUrl.isNullOrBlank() -> "📄 File"
            message.location != null -> "📍 Location"
            !message.contactInfo.isNullOrBlank() -> "👤 Contact"
            else -> "Message" // Fallback for any other case
        }
        textViewRepliedToMessage.text = messageContent

        // --- ✅ IMPROVED LOGIC ENDS HERE ---

        // Focus the input and show the keyboard
        messageInput.requestFocus()
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        imm.showSoftInput(messageInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun clearReplyingTo() {
        replyingToMessage = null
        replyPreviewLayout.visibility = View.GONE
    }

    // --- Callback Implementations & Other Methods ---

    override fun onReceiverParticipantDetailsReady(participant: Participant) {
        updateReceiverHeader(participant)
    }

    private fun updateReceiverHeader(participant: Participant) {
        textViewReceiverName.text = participant.username
        Glide.with(this)
            .load(participant.profileImage)
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .into(imageViewReceiverPicture)
    }

    override fun onReceiverParticipantStatusUpdate(isOnline: Boolean, statusText: String) {
        textViewOnlineStatus.text = statusText
        imageViewStatusIndicator.visibility = View.VISIBLE
        if (isOnline) {
            imageViewStatusIndicator.setImageResource(R.drawable.status_indicator_online)
        } else {
            imageViewStatusIndicator.setImageResource(R.drawable.status_indicator_offline)
        }
    }

    override fun showDefaultReceiverHeader(defaultName: String?) {
        textViewReceiverName.text = defaultName ?: "Chat"
        if (::imageViewReceiverPicture.isInitialized) {
            imageViewReceiverPicture.setImageResource(R.drawable.ic_default_profile)
        }
        textViewOnlineStatus.text = "" // Or "Status unavailable"
        imageViewStatusIndicator.visibility = View.GONE
    }

    override fun showToast(message: String, length: Int) {
        Toast.makeText(this, message, length).show()
    }

    override fun updateMessages(messages: List<ChatMessage>) {
        messageAdapter.submitList(messages.toList()) { // Use toList() for a new snapshot
            if (messages.isNotEmpty()) {
                val layoutManager = recyclerView.layoutManager as LinearLayoutManager
                val lastVisibleItemPosition = layoutManager.findLastVisibleItemPosition()
                // Smart scroll only if user is near the bottom, to avoid interrupting reading old messages
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

    override fun onMessageSent(message: ChatMessage) {
        chatActivityHelper.onMessageSentByHandler(message)
    }

    override fun onError(error: String) {
        chatActivityHelper.onErrorFromHandler(error)
    }

    override fun onMessageLongClicked(message: ChatMessage, itemView: View, position: Int): Boolean {
        Log.d("ChatActivity", "Long clicked message: '${message.text ?: "Media Message"}'")
        messageActionHandler.showPopupMenu(message, itemView, position)
        return true
    }

    private fun retrieveSessionAndValidate(): Boolean {
        token = TokenManager.getToken(this) ?: ""
        senderId = TokenManager.getUserId(this) ?: ""
        roomId = intent.getStringExtra("roomId")

        if (token.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, "Session is invalid. Please log in again.", Toast.LENGTH_LONG).show()
            finish() // Redirect to login or close
            return false
        }

        if (roomId.isNullOrBlank()) {
            Toast.makeText(this, "Error: Chat room ID is missing.", Toast.LENGTH_LONG).show()
            finish()
            return false
        }
        return true
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        var view = currentFocus
        if (view == null) {
            view = View(this)
        }
        imm.hideSoftInputFromWindow(view.windowToken, 0)
    }

    private fun requestNeededPermissions() {
        val permissionsToRequest = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }
        if (permissionsToRequest.isNotEmpty()) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
}
