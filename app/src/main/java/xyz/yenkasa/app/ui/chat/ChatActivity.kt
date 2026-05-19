package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.MessageAdapter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.ChatMediaItem
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.util.ChatCacheManager
import xyz.yenkasa.app.util.ChatNotificationState
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.webrtc.WebSocketProvider
import xyz.yenkasa.app.webrtc.SignalingMessageType
import com.google.android.gms.location.LocationServices
import de.hdodenhof.circleimageview.CircleImageView
import kotlinx.coroutines.launch

import xyz.yenkasa.app.ui.chat.ChatConstants
import xyz.yenkasa.app.ui.chat.ChatCallController
import xyz.yenkasa.app.ui.chat.ChatErrorParser
import xyz.yenkasa.app.ui.chat.ChatForwardController
import xyz.yenkasa.app.ui.chat.ChatGroupController
import xyz.yenkasa.app.ui.chat.ChatHeaderController
import xyz.yenkasa.app.ui.chat.ChatInputController
import xyz.yenkasa.app.ui.chat.ChatMediaController
import xyz.yenkasa.app.ui.chat.ChatMessageActionController
import xyz.yenkasa.app.ui.chat.ChatOptionsController
import xyz.yenkasa.app.ui.chat.ChatPermissionController
import xyz.yenkasa.app.ui.chat.ChatSoundController
import xyz.yenkasa.app.ui.chat.ChatSocketController
import xyz.yenkasa.app.ui.chat.ChatSocketListener
import xyz.yenkasa.app.ui.chat.ChatThemeController

class ChatActivity : AppCompatActivity(), ChatHelperCallback, ChatMessageHandler.ChatMessageCallback, MessageAdapter.OnMessageLongClickListener, ChatSocketListener {

    private lateinit var chatSocketController: ChatSocketController
    private lateinit var chatSoundController: ChatSoundController
    private lateinit var chatGroupController: ChatGroupController
    private lateinit var chatThemeController: ChatThemeController
    private lateinit var chatMediaController: ChatMediaController
    private lateinit var chatInputController: ChatInputController
    private lateinit var chatForwardController: ChatForwardController
    private lateinit var chatPermissionController: ChatPermissionController
    private lateinit var chatHeaderController: ChatHeaderController
    private lateinit var chatCallController: ChatCallController
    private lateinit var chatOptionsController: ChatOptionsController
    private lateinit var chatMessageActionController: ChatMessageActionController


    private lateinit var recyclerView: RecyclerView
    private lateinit var messageInput: RichContentEditText
    private lateinit var sendButton: ImageButton
    private lateinit var micButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var laughReactionButton: TextView
    private lateinit var attachMenu: LinearLayout
    private lateinit var chatRootLayout: FrameLayout
    private lateinit var moreOptionsButton: ImageView
    private lateinit var mediaPreviewLayout: View
    private lateinit var imageMediaPreview: ImageView
    private lateinit var textMediaPreviewPlay: TextView
    private lateinit var textMediaPreviewTitle: TextView
    private lateinit var textMediaPreviewSubtitle: TextView
    private lateinit var cancelMediaPreviewButton: ImageButton

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
    private var isGroupChat: Boolean = false
    private lateinit var callButton: ImageView
    private lateinit var videoCallButton: ImageView
    private val webSocketManager = WebSocketProvider.instance
    private var isChatVisible: Boolean = false


    private val uiHandler = Handler(Looper.getMainLooper())

    // --- Activity Result Launchers ---
    private val chatMediaPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(ChatMediaPickerActivity.MAX_SELECTION_COUNT)
    ) { uris: List<Uri> ->
        if (uris.isEmpty()) return@registerForActivityResult

        lifecycleScope.launch {
            chatMediaController.handlePickedMediaUris(uris)
        }
    }

    private val chatBackgroundImageLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult
        chatThemeController.handleCustomImageSelected(uri)
    }

    private val stickerPickerLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult

        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (ex: Exception) {
            Log.w("ChatActivity", "Could not persist sticker permission", ex)
        }

        chatMediaController.saveStickerUri(uri)
        Toast.makeText(this, R.string.sticker_saved_tap_send, Toast.LENGTH_SHORT).show()
        chatMediaController.showStickerTray()
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        chatMediaController.handleCameraCaptureResult(success)
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { chatMessageHandler.uploadFileToCloudinary(it, "file") }
    }

    private val chatMediaFlowLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) return@registerForActivityResult
        val data = result.data ?: return@registerForActivityResult
        @Suppress("DEPRECATION")
        val selectedItems = data.getSerializableExtra(ChatMediaPreviewActivity.EXTRA_MEDIA_ITEMS) as? ArrayList<ChatMediaItem>
        val caption = data.getStringExtra(ChatMediaPreviewActivity.EXTRA_CAPTION).orEmpty()
        if (selectedItems.isNullOrEmpty()) {
            Toast.makeText(this, R.string.chat_media_send_empty, Toast.LENGTH_SHORT).show()
            return@registerForActivityResult
        }
        chatMediaController.queueSelectedMediaForUpload(selectedItems, caption)
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
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.handlePermissionsResult(permissions)
        }
        if (::chatPermissionController.isInitialized) {
            chatPermissionController.handlePermissionsResult(permissions)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
        )
        setContentView(R.layout.activity_chat)

        initViews()
        chatPermissionController = ChatPermissionController(this) { permissions ->
            permissionsLauncher.launch(permissions)
        }
        chatSoundController = ChatSoundController(this)
        chatSoundController.initialize()
        chatThemeController = ChatThemeController(this, chatRootLayout)
        chatMediaController = ChatMediaController(
            activity = this,
            chatMessageHandlerProvider = { chatMessageHandler },
            openStickerPicker = { stickerPickerLauncher.launch(arrayOf("image/*")) },
            openVisualPicker = { request -> chatMediaPickerLauncher.launch(request) },
            openCameraCapture = { uri -> cameraLauncher.launch(uri) },
            openMediaPreview = { items ->
                val intent = Intent(this@ChatActivity, ChatMediaPreviewActivity::class.java).apply {
                    putExtra(ChatMediaPreviewActivity.EXTRA_MEDIA_ITEMS, ArrayList(items))
                    putExtra(ChatMediaPreviewActivity.EXTRA_INITIAL_INDEX, 0)
                }
                chatMediaFlowLauncher.launch(intent)
            },
            replyingToMessageIdProvider = { chatInputController.replyingToMessageId() },
            messageInput = messageInput,
            sendButton = sendButton,
            micButton = micButton,
            attachMenu = attachMenu,
            mediaPreviewLayout = mediaPreviewLayout,
            imageMediaPreview = imageMediaPreview,
            textMediaPreviewPlay = textMediaPreviewPlay,
            textMediaPreviewTitle = textMediaPreviewTitle,
            textMediaPreviewSubtitle = textMediaPreviewSubtitle
        )
        cancelMediaPreviewButton.setOnClickListener { chatMediaController.clearPendingMediaPreview() }
        chatMediaController.updateComposerActionButtons()
        chatInputController = ChatInputController(
            activity = this,
            chatRootLayout = chatRootLayout,
            recyclerView = recyclerView,
            messageAdapterProvider = { messageAdapter },
            messageInput = messageInput,
            attachMenu = attachMenu,
            mediaPreviewLayout = mediaPreviewLayout,
            replyPreviewLayout = replyPreviewLayout,
            textViewRepliedToName = textViewRepliedToName,
            textViewRepliedToMessage = textViewRepliedToMessage,
            receiverNameProvider = { textViewReceiverName.text?.toString().orEmpty() },
            senderIdProvider = { senderId }
        )

        if (!retrieveSessionAndValidate()) {
            return // Exit if session is not valid
        }
        chatHeaderController = ChatHeaderController(
            activity = this,
            isGroupChatProvider = { isGroupChat },
            groupImageProvider = { intent.getStringExtra("groupImage").orEmpty() },
            groupMemberCountProvider = { intent.getIntExtra("groupMemberCount", 0) },
            socketControllerProvider = { if (::chatSocketController.isInitialized) chatSocketController else null },
            receiverNameView = textViewReceiverName,
            receiverImageView = imageViewReceiverPicture,
            statusIndicatorView = imageViewStatusIndicator,
            statusTextView = textViewOnlineStatus
        )
        chatCallController = ChatCallController(
            activity = this,
            receiverProvider = { chatHeaderController.receiverParticipant },
            checkAndRequestPermission = { permission -> checkAndRequestPermission(permission) }
        )
        chatForwardController = ChatForwardController(this, senderIdProvider = { senderId }, parseError = ChatErrorParser::parse)

        // --- Initialize handlers and helpers ---
        chatMessageHandler = ChatMessageHandler(this, this, token, senderId, roomId!!)

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        chatGroupController = ChatGroupController(
            activity = this,
            isGroupChat = isGroupChat,
            roomIdProvider = { roomId },
            initialGroupImageProvider = { intent.getStringExtra("groupImage").orEmpty() },
            initialGroupMemberCountProvider = { intent.getIntExtra("groupMemberCount", 0) },
            receiverNameView = textViewReceiverName,
            receiverImageView = imageViewReceiverPicture,
            statusIndicatorView = imageViewStatusIndicator,
            statusTextView = textViewOnlineStatus,
            callButton = callButton,
            videoCallButton = videoCallButton
        )

        messageAdapter = MessageAdapter(
            currentUserId = senderId,
            receiverName = textViewReceiverName.text.toString(),
            isGroupChat = isGroupChat
        )
        messageAdapter.setOnMessageLongClickListener(this)

        // ✅ Ensure non-null roomId and proper initialization
        roomId?.let {
            chatActivityHelper = ChatActivityHelper(
                applicationContext,
                this,
                token,
                senderId,
                roomId!!,
                fusedLocationClient,
                uiHandler,
            )
            messageActionHandler = MessageActionHandler(this, senderId, chatActivityHelper)
            chatSocketController = ChatSocketController(senderId, roomId!!, this)
            chatMessageActionController = ChatMessageActionController(
                activity = this,
                senderIdProvider = { senderId },
                chatHelperProvider = { chatActivityHelper },
                receiverProvider = { chatHeaderController.receiverParticipant }
            )
        } ?: run {
            Log.e("ChatActivity", "❌ roomId is null — cannot start chat properly.")
            Toast.makeText(this, R.string.error_loading_chat, Toast.LENGTH_SHORT).show()
            finish()
            return
        }
        chatOptionsController = ChatOptionsController(
            activity = this,
            isGroupChatProvider = { isGroupChat },
            canManageGroup = { chatGroupController.canManageCurrentGroup() },
            openBackgroundPicker = {
                chatThemeController.showBackgroundPicker {
                    chatBackgroundImageLauncher.launch(arrayOf("image/*"))
                }
            },
            openProfile = {
                if (isGroupChat) chatGroupController.openProfile() else chatHeaderController.openReceiverProfile()
            },
            openAddMembers = { chatGroupController.openAddMembers() },
            confirmLeaveGroup = { chatGroupController.confirmLeave() },
            confirmDeleteGroup = { chatGroupController.confirmDelete() }
        )

        // --- Listen for signaling messages (CALL_REQUEST / ACCEPT / REJECT) ---
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { msg ->
                when (msg.type) {
                    SignalingMessageType.CALL_REQUEST -> {
                        Log.i("ChatActivity", "📞 Incoming call handled by shared WebSocketManager.")
                    }
                    SignalingMessageType.CALL_ACCEPT -> {
                        Log.d("ChatActivity", "✅ CALL_ACCEPT received — ignoring here (handled in VideoCallActivity)")
                    }
                    SignalingMessageType.CALL_REJECT -> {
                        Log.d("ChatActivity", "🚫 CALL_REJECT received — call dismissed.")
                    }
                    else -> {}
                }
            }
        }

        setupChatRecyclerView()
        chatThemeController.applySavedBackground()
        setupListeners()
        chatGroupController.configureHeaderIfNeeded()
        chatInputController.setupKeyboardAwareChatInput()

        if (isGroupChat) {
            showDefaultReceiverHeader(
                intent.getStringExtra("chatPartnerName")
                    ?: intent.getStringExtra("contactName")
                    ?: getString(R.string.group_default_name)
            )
        } else {
            showDefaultReceiverHeader(
                intent.getStringExtra("chatPartnerName")
                    ?: intent.getStringExtra("contactName")
            )
            chatActivityHelper.initializeHeaderInformation()
        }
        chatActivityHelper.fetchInitialMessages()
        requestNeededPermissions()
    }

    override fun onStart() {
        super.onStart()
        ChatNotificationState.setActiveRoom(roomId)
        webSocketManager.connect(this)
        if (::chatMessageHandler.isInitialized) {
            if (::chatSocketController.isInitialized) {
                chatSocketController.setReceiverParticipant(chatHeaderController.receiverParticipant)
            }
            if (!isGroupChat) {
                chatSocketController.setupPresenceListeners()
            }
            chatSocketController.setupListeners()
        }
    }

    override fun onResume() {
        super.onResume()
        isChatVisible = true
        if (isGroupChat && ::textViewReceiverName.isInitialized && ::chatGroupController.isInitialized) {
            chatGroupController.refreshHeader()
        }
    }

    override fun onPause() {
        isChatVisible = false
        super.onPause()
    }

    override fun onStop() {
        isChatVisible = false
        ChatNotificationState.clearActiveRoom(roomId)
        if (::chatSocketController.isInitialized) {
            chatSocketController.removeListeners()
        }
        if (::messageAdapter.isInitialized) {
            messageAdapter.pauseAllVideos()
        }
        webSocketManager.release(this)
        super.onStop()
    }

    // --- Add this to prevent the crash ---
    override fun onDestroy() {
        ChatNotificationState.clearActiveRoom(roomId)
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.cleanup()
        }
        if (::messageAdapter.isInitialized) {
            messageAdapter.releaseAllMedia()
            messageAdapter.setOnMessageLongClickListener(null)
        }
        if (::chatSocketController.isInitialized) {
            chatSocketController.removeListeners()
        }
        if (::chatGroupController.isInitialized) {
            chatGroupController.release()
        }
        if (::chatInputController.isInitialized) {
            chatInputController.release()
        }
        if (::recyclerView.isInitialized) {
            recyclerView.adapter = null
        }
        if (::imageMediaPreview.isInitialized) {
            runCatching { Glide.with(this).clear(imageMediaPreview) }
        }
        if (::chatPermissionController.isInitialized) {
            chatPermissionController.release()
        }
        uiHandler.removeCallbacksAndMessages(null)
        if (::chatSoundController.isInitialized) {
            chatSoundController.release()
        }
        super.onDestroy()
    }



    private fun initViews() {
        chatRootLayout = findViewById(R.id.chatRootLayout)
        recyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.btnSend)
        micButton = findViewById(R.id.btnMic)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
        laughReactionButton = findViewById(R.id.buttonLaughReaction)
        attachMenu = findViewById(R.id.attachmentMenu)
        callButton = findViewById(R.id.imageViewCall)
        videoCallButton = findViewById(R.id.imageViewVideoCall)
        moreOptionsButton = findViewById(R.id.imageViewMoreOptions)
        mediaPreviewLayout = findViewById(R.id.mediaPreviewLayout)
        imageMediaPreview = findViewById(R.id.imageMediaPreview)
        textMediaPreviewPlay = findViewById(R.id.textMediaPreviewPlay)
        textMediaPreviewTitle = findViewById(R.id.textMediaPreviewTitle)
        textMediaPreviewSubtitle = findViewById(R.id.textMediaPreviewSubtitle)
        cancelMediaPreviewButton = findViewById(R.id.buttonCancelMediaPreview)

        textViewReceiverName = findViewById(R.id.textViewReceiverName)
        imageViewReceiverPicture = findViewById(R.id.imageViewReceiverPicture)
        imageViewStatusIndicator = findViewById(R.id.imageViewStatusIndicator)
        textViewOnlineStatus = findViewById(R.id.textViewOnlineStatus)

        // Reply views
        replyPreviewLayout = findViewById(R.id.replyPreviewLayout)
        textViewRepliedToName = findViewById(R.id.textViewRepliedToName)
        textViewRepliedToMessage = findViewById(R.id.textViewRepliedToMessage)
        buttonCancelReply = findViewById(R.id.buttonCancelReply)
    }

    private fun setupListeners() {
        findViewById<ImageView>(R.id.imageViewBackButton).setOnClickListener { finish() }
        moreOptionsButton.setOnClickListener { chatOptionsController.show(it) }
        if (isGroupChat) {
            imageViewReceiverPicture.setOnClickListener { chatGroupController.openProfile() }
            textViewReceiverName.setOnClickListener { chatGroupController.openProfile() }
            textViewOnlineStatus.setOnClickListener { chatGroupController.openProfile() }
        } else {
            imageViewReceiverPicture.setOnClickListener { chatHeaderController.openReceiverProfile() }
            textViewReceiverName.setOnClickListener { chatHeaderController.openReceiverProfile() }
            textViewOnlineStatus.setOnClickListener { chatHeaderController.openReceiverProfile() }
        }

        buttonCancelReply.setOnClickListener { chatInputController.clearReplyingTo() }

        findViewById<ImageButton>(R.id.buttonAttachImage).setOnClickListener {
            attachMenu.visibility = View.GONE
            chatMediaController.launchChatMediaPicker()
        }
        findViewById<ImageButton>(R.id.buttonAttachVideo).setOnClickListener {
            attachMenu.visibility = View.GONE
            chatMediaController.launchChatMediaPicker()
        }
        findViewById<ImageButton>(R.id.buttonAttachCamera).setOnClickListener {
            attachMenu.visibility = View.GONE
            if (!chatPermissionController.hasPermission(Manifest.permission.CAMERA)) {
                chatPermissionController.requestPermissions(Manifest.permission.CAMERA) {
                    chatMediaController.launchCameraCapture()
                }
                return@setOnClickListener
            }
            chatMediaController.launchCameraCapture()
        }
        findViewById<ImageButton>(R.id.buttonAttachLocation).setOnClickListener {
            attachMenu.visibility = View.GONE
            if (!chatPermissionController.hasAnyPermission(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) {
                chatPermissionController.requestPermissions(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) {
                    chatActivityHelper.sendCurrentLocation()
                }
                return@setOnClickListener
            }
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

        findViewById<ImageButton>(R.id.buttonEmojiShortcut).setOnClickListener {
            attachMenu.visibility = View.GONE
            chatInputController.showEmojiPicker()
        }

        findViewById<ImageButton>(R.id.buttonStickerShortcut).setOnClickListener {
            attachMenu.visibility = View.GONE
            chatMediaController.showStickerTray()
        }

        laughReactionButton.setOnClickListener {
            attachMenu.visibility = View.GONE
            hideKeyboard()
            sendLaughReaction()
        }

        messageInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                chatMediaController.updateComposerActionButtons()
                val hasText = !s.isNullOrBlank()
                messageInput.maxLines = if (hasText) 5 else 1
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (chatMediaController.hasPendingMedia()) {
                chatMediaController.uploadPendingMedia(text)
                return@setOnClickListener
            }

            if (text.isNotEmpty()) {
                val messageData = mutableMapOf<String, Any>("text" to text)

                chatInputController.replyingToMessageId()?.let { repliedToId ->
                    messageData["repliedTo"] = repliedToId
                }

                chatMessageHandler.sendMessage(messageData)
                messageInput.setText("")
                val replyingToLog = chatInputController.replyingToMessageForLog()
                chatInputController.clearReplyingTo()
                hideKeyboard()
                Log.d("ChatActivity", "Sending reply → repliedTo=$replyingToLog")

            }
        }

        micButton.setOnClickListener {
            if (checkAndRequestPermission(Manifest.permission.RECORD_AUDIO)) {
                val intent = Intent(this, AudioRecActivity::class.java)
                audioRecLauncher.launch(intent)
            } else {
                Toast.makeText(this, R.string.audio_recording_permission_needed, Toast.LENGTH_SHORT).show()
            }
        }

        attachButton.setOnClickListener {
            if (attachMenu.visibility == View.GONE) {
                hideKeyboard()
            }
            attachMenu.visibility = if (attachMenu.visibility == View.GONE) View.VISIBLE else View.GONE
        }

        callButton.setOnClickListener {
            chatCallController.startVideoCall(isVideo = false)
        }

        videoCallButton.setOnClickListener {
            chatCallController.startVideoCall(isVideo = true)
        }

        messageInput.onRichContentListener = { contentUri ->

            Log.d("ChatActivity", "Sticker received with URI: $contentUri")
            // Use your existing handler to upload it as an "image"
            chatMessageHandler.uploadFileToCloudinary(contentUri, "image")
        }
    }

    override fun hasPermission(permission: String): Boolean {
        return chatPermissionController.hasPermission(permission)
    }

    private fun setupChatRecyclerView() {
        recyclerView.layoutManager = LinearLayoutManager(this).apply {
            stackFromEnd = true
        }
        recyclerView.adapter = messageAdapter

        val swipeToReplyCallback = SwipeToReplyCallback(this) { viewHolder: RecyclerView.ViewHolder ->
            val position = viewHolder.bindingAdapterPosition
            if (position != RecyclerView.NO_POSITION) {
                val message = messageAdapter.currentList[position]
                chatInputController.showReplyPreview(message)
                messageAdapter.notifyItemChanged(position)
            }
        }

        val itemTouchHelper = ItemTouchHelper(swipeToReplyCallback)
        itemTouchHelper.attachToRecyclerView(recyclerView)
    }

    private fun sendLaughReaction() {
        val activeRoomId = roomId ?: return
        if (!chatSoundController.tryMarkLaughReactionSent()) return
        chatInputController.showLaughReactionAnimation()
        chatMessageHandler.sendMessage(
            mapOf(
                "text" to ChatConstants.LAUGH_REACTION_TEXT_MARKER,
                "messageType" to ChatConstants.LAUGH_REACTION_MESSAGE_TYPE
            )
        )
    }

    private fun isIncomingMessageFromOtherUser(message: ChatMessage): Boolean {
        val messageSenderId = message.senderId ?: message.sender?._id
        return !messageSenderId.isNullOrBlank() && messageSenderId != senderId
    }

    private fun ChatMessage.isLaughReaction(): Boolean {
        return messageType == ChatConstants.LAUGH_REACTION_MESSAGE_TYPE || text == ChatConstants.LAUGH_REACTION_TEXT_MARKER
    }

    private fun upsertRealtimeMessage(message: ChatMessage) {
        val messageId = message.id
        val currentMessages = messageAdapter.currentList.toMutableList()
        val existingIndex = currentMessages.indexOfFirst { it.id == messageId && messageId != null }
        if (existingIndex >= 0) {
            currentMessages[existingIndex] = message
        } else {
            currentMessages.add(message)
        }
        updateMessages(currentMessages)
    }

    override fun onMessageReceived(message: ChatMessage) {
        runOnUiThread {
            upsertRealtimeMessage(message)
            if (isIncomingMessageFromOtherUser(message)) {
                if (message.isLaughReaction()) {
                    chatSoundController.playLaughReactionSound(isChatVisible)
                    chatInputController.showLaughReactionAnimation()
                } else {
                    chatSoundController.playInChatMessageSound(isChatVisible)
                }
            }
            if (::chatActivityHelper.isInitialized) {
                chatActivityHelper.markRoomAsRead()
            }
        }
    }

    override fun onMessageEdited(message: ChatMessage) {
        runOnUiThread { upsertRealtimeMessage(message) }
    }

    override fun onMessageDeleted(messageId: String) {
        runOnUiThread {
            val updatedMessages = messageAdapter.currentList
                .filterNot { it.id == messageId }
            updateMessages(updatedMessages)
        }
    }

    override fun onPresenceChanged(isOnline: Boolean, statusText: String) {
        val resolvedStatus = when (statusText.lowercase()) {
            ChatConstants.STATUS_ONLINE -> getString(R.string.online)
            ChatConstants.STATUS_OFFLINE -> getString(R.string.offline)
            else -> statusText
        }
        runOnUiThread {
            onReceiverParticipantStatusUpdate(isOnline, resolvedStatus)
        }
    }

    // --- Callback Implementations & Other Methods ---

    override fun onReceiverParticipantDetailsReady(participant: Participant) {
        chatHeaderController.handleReceiverParticipantDetails(participant)
    }

    override fun onReceiverParticipantStatusUpdate(isOnline: Boolean, statusText: String) {
        chatHeaderController.updateReceiverStatus(isOnline, statusText)
    }

    override fun showDefaultReceiverHeader(defaultName: String?) {
        chatHeaderController.showDefaultHeader(defaultName)
    }

    override fun showToast(message: String, length: Int) {
        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            Log.d("ChatActivity", "Suppressing background toast: $message")
            return
        }
        Toast.makeText(this, message, length).show()
    }

    override fun updateMessages(messages: List<ChatMessage>) {
        roomId?.takeIf { it.isNotBlank() }?.let { activeRoomId ->
            ChatCacheManager.saveMessagesAsync(applicationContext, activeRoomId, messages)
        }
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
        return chatPermissionController.checkAndRequestPermission(permission)
    }

    override fun requestDeleteConfirmation(messageToDelete: ChatMessage) {
        chatMessageActionController.requestDeleteConfirmation(messageToDelete)
    }

    override fun requestEditMessage(messageToEdit: ChatMessage, positionInAdapter: Int) {
        chatMessageActionController.requestEditMessage(messageToEdit)
    }

    override fun requestReplyToMessage(message: ChatMessage) {
        chatInputController.showReplyPreview(message)
    }

    override fun requestForwardMessage(message: ChatMessage) {
        chatForwardController.requestForwardMessage(message)
    }

    override fun onMessageSent(message: ChatMessage) {
        Log.d(
            "ChatActivity",
            "Message sent callback: id=${message.id}, image=${message.imageUrl}, video=${message.videoUrl}, file=${message.fileUrl}, text=${message.text}"
        )
        chatMediaController.clearPendingMediaAfterSentIfNeeded()
        chatActivityHelper.onMessageSentByHandler(message)
        chatMediaController.continueQueuedUploadIfNeeded()
    }

    override fun onError(error: String) {
        chatActivityHelper.onErrorFromHandler(error)
        chatMediaController.resetFailedOutgoingState()
    }

    override fun onSendRejected(code: Int, reason: String?, message: String) {
        if (code == 423 && reason == "requires_approval") {
            chatMessageActionController.sendMessageApprovalRequest(message)
            chatMediaController.resetFailedOutgoingState()
            return
        }

        onError(message)
    }

    override fun onUploadStarted(type: String) {
        val label = when (type) {
            "image" -> getString(R.string.upload_type_photo)
            "audio" -> getString(R.string.upload_type_audio)
            "video" -> getString(R.string.upload_type_video)
            else -> getString(R.string.upload_type_file)
        }
        Toast.makeText(this, getString(R.string.uploading_type, label), Toast.LENGTH_SHORT).show()
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
        isGroupChat = intent.getBooleanExtra("isGroupChat", false)

        if (token.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, R.string.session_expired_login_again, Toast.LENGTH_LONG).show()
            finish() // Redirect to login or close
            return false
        }

        if (roomId.isNullOrBlank()) {
            Toast.makeText(this, R.string.chat_room_id_missing, Toast.LENGTH_LONG).show()
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
        chatPermissionController.requestNeededPermissions()
    }
}
