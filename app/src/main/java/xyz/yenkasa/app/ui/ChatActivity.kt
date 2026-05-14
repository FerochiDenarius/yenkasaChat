package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.SoundPool
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.ContactsContract
import android.provider.OpenableColumns
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.RelativeLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.result.PickVisualMediaRequest
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.google.gson.Gson
import com.google.android.material.bottomsheet.BottomSheetDialog
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.EmojiPickerAdapter
import xyz.yenkasa.app.webrtc.VideoCallActivity
import xyz.yenkasa.app.adapter.MessageAdapter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.ChatMediaItem
import xyz.yenkasa.app.model.ChatRoom
import xyz.yenkasa.app.model.Contact
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.model.MessageRequest
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.model.PresenceResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.ChatBackgroundManager
import xyz.yenkasa.app.util.ChatNotificationState
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.webrtc.WebSocketProvider
import xyz.yenkasa.app.webrtc.SignalingMessageType
import com.google.android.gms.location.LocationServices
import de.hdodenhof.circleimageview.CircleImageView
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException
import java.util.ArrayDeque

class ChatActivity : AppCompatActivity(), ChatHelperCallback, ChatMessageHandler.ChatMessageCallback, MessageAdapter.OnMessageLongClickListener {

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
    private var currentGroupDetails: ChatRoom? = null
    private var tempCameraUri: Uri? = null
    private var pendingMediaUri: Uri? = null
    private var pendingMediaType: String? = null
    private var isUploadingPendingMedia: Boolean = false
    private var pendingPermissionAction: (() -> Unit)? = null
    private var replyingToMessage: ChatMessage? = null
    private val outgoingMediaQueue = ArrayDeque<QueuedMediaUpload>()
    private var isUploadingMediaQueue: Boolean = false
    private lateinit var callButton: ImageView
    private lateinit var videoCallButton: ImageView
    private val webSocketManager = WebSocketProvider.instance
    private var receiverParticipant: Participant? = null
    private val chatMessageGson = Gson()
    private var isChatVisible: Boolean = false
    private var soundPool: SoundPool? = null
    private var inChatMessageSoundId: Int = 0
    private var laughReactionSoundId: Int = 0
    private val loadedSoundIds = mutableSetOf<Int>()
    private var lastInChatMessageSoundAt: Long = 0L
    private var lastLaughReactionSentAt: Long = 0L
    private var lastLaughReactionPlayedAt: Long = 0L

    private val uiHandler = Handler(Looper.getMainLooper())

    private data class QueuedMediaUpload(
        val uri: Uri,
        val type: String,
        val caption: String? = null
    )

    private data class ChatThemePreset(
        val key: String,
        val labelRes: Int,
        val colors: IntArray?,
        val orientation: GradientDrawable.Orientation = GradientDrawable.Orientation.TL_BR,
        val solidColor: Int? = null,
        val drawableRes: Int? = null
    )

    private val chatThemePresets = listOf(
        ChatThemePreset(
            "default",
            R.string.chat_theme_yenkasa_default,
            null
        ),
        ChatThemePreset(
            "africa_skyline_dark",
            R.string.chat_theme_africa_skyline_dark,
            null,
            drawableRes = R.drawable.chat_theme_africa_skyline_dark
        ),
        ChatThemePreset(
            "softotech_light",
            R.string.chat_theme_softotech_light,
            null,
            drawableRes = R.drawable.chat_theme_softotech_light
        ),
        ChatThemePreset(
            "yenkasa_cream",
            R.string.chat_theme_yenkasa_cream,
            null,
            drawableRes = R.drawable.chat_theme_yenkasa_cream
        ),
        ChatThemePreset(
            "africa_network_blue",
            R.string.chat_theme_africa_network_blue,
            null,
            drawableRes = R.drawable.chat_theme_africa_network_blue
        ),
        ChatThemePreset(
            "ykc_gold_dark",
            R.string.chat_theme_ykc_gold_dark,
            null,
            drawableRes = R.drawable.chat_theme_ykc_gold_dark
        ),
        ChatThemePreset(
            "savanna_green",
            R.string.chat_theme_savanna_green,
            null,
            drawableRes = R.drawable.chat_theme_savanna_green
        ),
        ChatThemePreset(
            "whatsapp_light",
            R.string.chat_theme_whatsapp_light,
            intArrayOf(Color.parseColor("#EFE7DC"), Color.parseColor("#DDEEDB")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "whatsapp_dark",
            R.string.chat_theme_whatsapp_dark,
            intArrayOf(Color.parseColor("#0B141A"), Color.parseColor("#1F2C34")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "cool_mint",
            R.string.chat_theme_cool_mint,
            intArrayOf(Color.parseColor("#D9F7E8"), Color.parseColor("#EAF8FF")),
            GradientDrawable.Orientation.TOP_BOTTOM
        ),
        ChatThemePreset(
            "ocean",
            R.string.chat_theme_ocean,
            intArrayOf(Color.parseColor("#D8F3F5"), Color.parseColor("#BFD7EA")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "sunset",
            R.string.chat_theme_sunset,
            intArrayOf(Color.parseColor("#FDE2D2"), Color.parseColor("#F7D6E0")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "graphite",
            R.string.chat_theme_graphite,
            intArrayOf(Color.parseColor("#202124"), Color.parseColor("#3C4043")),
            GradientDrawable.Orientation.TOP_BOTTOM
        )
    )

    // --- Activity Result Launchers ---
    private val chatMediaPickerLauncher = registerForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(ChatMediaPickerActivity.MAX_SELECTION_COUNT)
    ) { uris: List<Uri> ->
        if (uris.isEmpty()) return@registerForActivityResult

        lifecycleScope.launch {
            val items = buildPickedMediaItems(uris)
            if (items.isEmpty()) {
                Toast.makeText(this@ChatActivity, R.string.chat_media_send_empty, Toast.LENGTH_SHORT).show()
                return@launch
            }
            launchChatMediaPreview(items)
        }
    }

    private val chatBackgroundImageLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult

        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (ex: Exception) {
            Log.w("ChatActivity", "Could not persist chat background image permission", ex)
        }

        ChatBackgroundManager.saveBackgroundUri(this, uri)
        if (applyCustomChatBackground(uri)) {
            Toast.makeText(this, R.string.chat_background_updated, Toast.LENGTH_SHORT).show()
        } else {
            ChatBackgroundManager.clearBackground(this)
            applyChatBackground("default")
            Toast.makeText(this, R.string.chat_background_image_unusable, Toast.LENGTH_SHORT).show()
        }
    }

    private val stickerPickerLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri: Uri? ->
        uri ?: return@registerForActivityResult

        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (ex: Exception) {
            Log.w("ChatActivity", "Could not persist sticker permission", ex)
        }

        saveStickerUri(uri)
        Toast.makeText(this, R.string.sticker_saved_tap_send, Toast.LENGTH_SHORT).show()
        showStickerTray()
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            val imageUri = tempCameraUri
            if (imageUri == null) {
                Toast.makeText(this, R.string.camera_image_not_saved_try_again, Toast.LENGTH_LONG).show()
            } else {
                Log.d("ChatActivity", "Camera capture ready: $imageUri")
                launchChatMediaPreview(
                    listOf(
                        ChatMediaItem(
                            id = System.currentTimeMillis(),
                            uriString = imageUri.toString(),
                            mimeType = "image/jpeg",
                            displayName = "camera_${System.currentTimeMillis()}.jpg",
                            isVideo = false
                        )
                    )
                )
            }
        } else {
            Toast.makeText(this, R.string.photo_cancelled, Toast.LENGTH_SHORT).show()
        }
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
        queueSelectedMediaForUpload(selectedItems, caption)
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
        val pendingAction = pendingPermissionAction
        pendingPermissionAction = null
        if (pendingAction != null && permissions.values.any { it }) {
            pendingAction.invoke()
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
        initializeChatSoundEffects()

        if (!retrieveSessionAndValidate()) {
            return // Exit if session is not valid
        }

        // --- Initialize handlers and helpers ---
        chatMessageHandler = ChatMessageHandler(this, this, token, senderId, roomId!!)

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

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
        } ?: run {
            Log.e("ChatActivity", "❌ roomId is null — cannot start chat properly.")
            Toast.makeText(this, R.string.error_loading_chat, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        if (!isGroupChat) {
            setupPresenceListeners()
        }
        setupRealtimeMessageListeners()

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
        applySavedChatBackground()
        setupListeners()
        configureGroupHeaderIfNeeded()
        setupKeyboardAwareChatInput()

        if (isGroupChat) {
            showDefaultReceiverHeader(
                intent.getStringExtra("chatPartnerName")
                    ?: intent.getStringExtra("contactName")
                    ?: "Yenkasa Group"
            )
        } else {
            // ✅ Now safe: only called after helper initialized
            chatActivityHelper.initializeHeaderInformation()
        }
        chatActivityHelper.startFetchingMessagesRepeatedly()
        requestNeededPermissions()
    }

    override fun onStart() {
        super.onStart()
        ChatNotificationState.setActiveRoom(roomId)
        webSocketManager.connect(this)
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.startFetchingMessagesRepeatedly()
        }
        joinRealtimeChatRoom()
    }

    override fun onResume() {
        super.onResume()
        isChatVisible = true
        if (isGroupChat && ::textViewReceiverName.isInitialized) {
            refreshGroupHeader()
        }
    }

    override fun onPause() {
        isChatVisible = false
        super.onPause()
    }

    override fun onStop() {
        isChatVisible = false
        ChatNotificationState.clearActiveRoom(roomId)
        leaveRealtimeChatRoom()
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.stopFetchingMessages()
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
            messageAdapter.pauseAllVideos()
        }
        SocketManager.off("getOnlineUsers")
        SocketManager.off("userStatusChanged")
        SocketManager.off("presence:update")
        SocketManager.off("messageCreated")
        SocketManager.off("messageEdited")
        SocketManager.off("messageDeleted")
        releaseChatSoundEffects()
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
        cancelMediaPreviewButton.setOnClickListener { clearPendingMediaPreview() }

        updateComposerActionButtons()
    }

    private fun setupListeners() {
        findViewById<ImageView>(R.id.imageViewBackButton).setOnClickListener { finish() }
        moreOptionsButton.setOnClickListener { showChatOptionsMenu(it) }
        if (isGroupChat) {
            imageViewReceiverPicture.setOnClickListener { openGroupProfile() }
            textViewReceiverName.setOnClickListener { openGroupProfile() }
            textViewOnlineStatus.setOnClickListener { openGroupProfile() }
        } else {
            imageViewReceiverPicture.setOnClickListener { openReceiverProfile() }
            textViewReceiverName.setOnClickListener { openReceiverProfile() }
            textViewOnlineStatus.setOnClickListener { openReceiverProfile() }
        }

        buttonCancelReply.setOnClickListener { clearReplyingTo() }

        findViewById<ImageButton>(R.id.buttonAttachImage).setOnClickListener {
            attachMenu.visibility = View.GONE
            launchChatMediaPicker()
        }
        findViewById<ImageButton>(R.id.buttonAttachVideo).setOnClickListener {
            attachMenu.visibility = View.GONE
            launchChatMediaPicker()
        }
        findViewById<ImageButton>(R.id.buttonAttachCamera).setOnClickListener {
            attachMenu.visibility = View.GONE
            if (!hasPermission(Manifest.permission.CAMERA)) {
                pendingPermissionAction = { launchCameraCapture() }
                permissionsLauncher.launch(arrayOf(Manifest.permission.CAMERA))
                return@setOnClickListener
            }
            launchCameraCapture()
        }
        findViewById<ImageButton>(R.id.buttonAttachLocation).setOnClickListener {
            attachMenu.visibility = View.GONE
            if (!hasAnyPermission(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) {
                pendingPermissionAction = { chatActivityHelper.sendCurrentLocation() }
                permissionsLauncher.launch(
                    arrayOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                    )
                )
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
            showEmojiPicker()
        }

        findViewById<ImageButton>(R.id.buttonStickerShortcut).setOnClickListener {
            attachMenu.visibility = View.GONE
            showStickerTray()
        }

        laughReactionButton.setOnClickListener {
            attachMenu.visibility = View.GONE
            hideKeyboard()
            sendLaughReaction()
        }

        messageInput.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) {
                updateComposerActionButtons()
                val hasText = !s.isNullOrBlank()
                messageInput.maxLines = if (hasText) 5 else 1
            }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (pendingMediaUri != null && pendingMediaType != null) {
                uploadPendingMedia(text)
                return@setOnClickListener
            }

            if (text.isNotEmpty()) {
                val messageData = mutableMapOf<String, Any>("text" to text)

                replyingToMessage?.id?.let { repliedToId ->
                    messageData["repliedTo"] = repliedToId
                }

                chatMessageHandler.sendMessage(messageData)
                messageInput.setText("")
                clearReplyingTo()
                hideKeyboard()
                Log.d("ChatActivity", "Sending reply → repliedTo=$replyingToMessage")

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
            startVideoCall(isVideo = false)
        }

        videoCallButton.setOnClickListener {
            startVideoCall(isVideo = true)
        }

        messageInput.onRichContentListener = { contentUri ->

            Log.d("ChatActivity", "Sticker received with URI: $contentUri")
            // Use your existing handler to upload it as an "image"
            chatMessageHandler.uploadFileToCloudinary(contentUri, "image")
        }
    }

    private fun showEmojiPicker() {
        hideKeyboard()
        attachMenu.visibility = View.GONE

        val bottomSheet = BottomSheetDialog(this)
        val root = layoutInflater.inflate(R.layout.activity_chat_media_picker, null)
        bottomSheet.setContentView(root)

        root.findViewById<ImageButton>(R.id.buttonPickerClose).setOnClickListener { bottomSheet.dismiss() }
        root.findViewById<TextView>(R.id.textSelectedCount).text = getString(R.string.chat_emoji_recent_hint)
        root.findViewById<ImageButton>(R.id.buttonPickerNext).visibility = View.GONE
        root.findViewById<TextView>(R.id.tabAll).apply {
            text = getString(R.string.chat_emoji_title)
            setBackgroundResource(R.drawable.bg_chat_media_tab_selected)
        }
        root.findViewById<TextView>(R.id.tabPhotos).visibility = View.GONE
        root.findViewById<TextView>(R.id.tabVideos).visibility = View.GONE
        root.findViewById<TextView>(R.id.viewPickerLoading).visibility = View.GONE
        root.findViewById<TextView>(R.id.textPickerEmptyState).visibility = View.GONE
        root.findViewById<RecyclerView>(R.id.recyclerSelectedMedia).visibility = View.GONE

        val emojis = listOf(
            "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
            "🥳", "😭", "😡", "🙏", "👍", "👏", "🔥", "💚",
            "❤️", "💯", "🎉", "✨", "👀", "🤝", "🙌", "🤍",
            "😅", "😴", "🤔", "😇", "😋", "🥹", "😢", "😬"
        )

        root.findViewById<RecyclerView>(R.id.recyclerMediaPicker).apply {
            layoutManager = GridLayoutManager(this@ChatActivity, 6)
            adapter = EmojiPickerAdapter(emojis) { emoji ->
                insertEmoji(emoji)
                bottomSheet.dismiss()
            }
        }

        bottomSheet.show()
    }

    private fun insertEmoji(emoji: String) {
        val editable = messageInput.text ?: return
        val start = messageInput.selectionStart.coerceAtLeast(0)
        val end = messageInput.selectionEnd.coerceAtLeast(0)
        val min = minOf(start, end)
        val max = maxOf(start, end)
        editable.replace(min, max, emoji)
        messageInput.requestFocus()
    }

    private fun showPendingMediaPreview(uri: Uri, type: String) {
        pendingMediaUri = uri
        pendingMediaType = type
        isUploadingPendingMedia = false

        mediaPreviewLayout.visibility = View.VISIBLE
        textMediaPreviewTitle.text = getString(if (type == "video") R.string.chat_media_video_ready else R.string.chat_media_photo_ready)
        textMediaPreviewSubtitle.text = getString(R.string.chat_media_tap_send_when_ready)
        textMediaPreviewPlay.visibility = if (type == "video") View.VISIBLE else View.GONE
        Glide.with(imageMediaPreview)
            .load(uri)
            .centerCrop()
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .listener(
                ChatPreviewGlideListener(
                    onSuccess = {
                        Log.d("ChatActivity", "Composer preview loaded: $uri")
                    },
                    onFailure = {
                        Log.w("ChatActivity", "Composer preview failed: $uri")
                        textMediaPreviewSubtitle.text = getString(R.string.chat_media_preview_failed)
                    }
                )
            )
            .into(imageMediaPreview)

        attachMenu.visibility = View.GONE
        updateComposerActionButtons()
    }

    private fun uploadPendingMedia(caption: String) {
        val uri = pendingMediaUri ?: return
        val type = pendingMediaType ?: return
        if (isUploadingPendingMedia) return

        isUploadingPendingMedia = true
        textMediaPreviewSubtitle.text = getString(R.string.uploading)
        updateComposerActionButtons()

        val extraData = mutableMapOf<String, Any?>()
        if (caption.isNotBlank()) {
            extraData["text"] = caption
        }
        replyingToMessage?.id?.let { repliedToId ->
            extraData["repliedTo"] = repliedToId
        }

        chatMessageHandler.uploadFileToCloudinary(uri, type, extraData)
    }

    private fun clearPendingMediaPreview() {
        pendingMediaUri = null
        pendingMediaType = null
        isUploadingPendingMedia = false
        imageMediaPreview.setImageDrawable(null)
        mediaPreviewLayout.visibility = View.GONE
        updateComposerActionButtons()
    }

    private fun updateComposerActionButtons() {
        val hasText = !messageInput.text.isNullOrBlank()
        val hasPendingMedia = pendingMediaUri != null
        sendButton.visibility = if (hasText || hasPendingMedia) View.VISIBLE else View.GONE
        val disableSend = isUploadingPendingMedia || isUploadingMediaQueue
        sendButton.isEnabled = !disableSend
        sendButton.alpha = if (disableSend) 0.55f else 1f
        micButton.visibility = if (!hasText && !hasPendingMedia) View.VISIBLE else View.GONE
    }

    private fun launchChatMediaPicker() {
        try {
            chatMediaPickerLauncher.launch(
                PickVisualMediaRequest(
                    ActivityResultContracts.PickVisualMedia.ImageAndVideo
                )
            )
        } catch (e: Exception) {
            Log.e("ChatActivity", "Unable to launch media picker", e)
            Toast.makeText(this, R.string.chat_media_picker_open_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun launchChatMediaPreview(items: List<ChatMediaItem>) {
        clearPendingMediaPreview()
        val intent = Intent(this@ChatActivity, ChatMediaPreviewActivity::class.java).apply {
            putExtra(ChatMediaPreviewActivity.EXTRA_MEDIA_ITEMS, ArrayList(items))
            putExtra(ChatMediaPreviewActivity.EXTRA_INITIAL_INDEX, 0)
        }
        chatMediaFlowLauncher.launch(intent)
    }

    private suspend fun buildPickedMediaItems(uris: List<Uri>): List<ChatMediaItem> {
        return kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
            uris.mapIndexedNotNull { index, uri ->
                try {
                    val mimeType = contentResolver.getType(uri).orEmpty()
                    ChatMediaItem(
                        id = System.currentTimeMillis() + index,
                        uriString = uri.toString(),
                        mimeType = mimeType,
                        displayName = queryDisplayName(uri) ?: "media_${index + 1}",
                        isVideo = mimeType.startsWith("video/")
                    )
                } catch (e: Exception) {
                    Log.w("ChatActivity", "Skipping picked media URI: $uri", e)
                    null
                }
            }
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) cursor.getString(nameIndex) else null
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w("ChatActivity", "Unable to resolve media name for $uri", e)
            null
        } finally {
            cursor?.close()
        }
    }

    private fun queueSelectedMediaForUpload(selectedItems: List<ChatMediaItem>, caption: String) {
        outgoingMediaQueue.clear()
        selectedItems.forEachIndexed { index, item ->
            Log.d(
                "ChatActivity",
                "Queueing media item: uri=${item.uriString}, mime=${item.mimeType}, isVideo=${item.isVideo}, name=${item.displayName}"
            )
            outgoingMediaQueue.add(
                QueuedMediaUpload(
                    uri = Uri.parse(item.uriString),
                    type = if (item.isVideo) "video" else "image",
                    caption = if (index == 0) caption.takeIf { it.isNotBlank() } else null
                )
            )
        }

        if (outgoingMediaQueue.isEmpty()) {
            Toast.makeText(this, R.string.chat_media_send_empty, Toast.LENGTH_SHORT).show()
            return
        }

        isUploadingMediaQueue = true
        updateComposerActionButtons()
        Toast.makeText(this, R.string.chat_media_batch_uploading, Toast.LENGTH_SHORT).show()
        uploadNextQueuedMedia()
    }

    private fun uploadNextQueuedMedia() {
        val next = if (outgoingMediaQueue.isEmpty()) null else outgoingMediaQueue.removeFirst()
        if (next == null) {
            isUploadingMediaQueue = false
            updateComposerActionButtons()
            Toast.makeText(this, R.string.chat_media_batch_complete, Toast.LENGTH_SHORT).show()
            return
        }

        val extraData = mutableMapOf<String, Any?>()
        next.caption?.let { extraData["text"] = it }
        replyingToMessage?.id?.let { extraData["repliedTo"] = it }
        Log.d("ChatActivity", "Uploading queued media: uri=${next.uri}, type=${next.type}, caption=${next.caption}")
        chatMessageHandler.uploadFileToCloudinary(next.uri, next.type, extraData)
    }

    private fun showStickerTray() {
        val stickers = loadSavedStickerUris()
        val bottomSheet = BottomSheetDialog(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(20))
            setBackgroundColor(ContextCompat.getColor(this@ChatActivity, R.color.feed_surface))
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val title = TextView(this).apply {
            text = "Stickers"
            textSize = 18f
            setTextColor(ContextCompat.getColor(this@ChatActivity, R.color.feed_primary_text))
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }

        val subtitle = TextView(this).apply {
            text = "Tap to send. Long press to delete."
            textSize = 12f
            setTextColor(ContextCompat.getColor(this@ChatActivity, R.color.feed_secondary_text))
        }

        val titleStack = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(subtitle)
        }

        val closeButton = ImageButton(this).apply {
            setImageResource(R.drawable.ic_close)
            background = ContextCompat.getDrawable(this@ChatActivity, R.drawable.bg_chat_header_icon_button)
            setColorFilter(ContextCompat.getColor(this@ChatActivity, R.color.yenkasa_emerald))
            setPadding(dp(10), dp(10), dp(10), dp(10))
            setOnClickListener { bottomSheet.dismiss() }
        }

        header.addView(
            titleStack,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        )
        header.addView(closeButton, LinearLayout.LayoutParams(dp(38), dp(38)))

        val recycler = RecyclerView(this).apply {
            layoutManager = GridLayoutManager(this@ChatActivity, 4)
            overScrollMode = View.OVER_SCROLL_NEVER
            adapter = StickerTrayAdapter(
                stickers = stickers,
                onAddSticker = {
                    bottomSheet.dismiss()
                    stickerPickerLauncher.launch(arrayOf("image/*"))
                },
                onSendSticker = { uri ->
                    bottomSheet.dismiss()
                    sendSticker(uri)
                },
                onDeleteSticker = { uri ->
                    confirmDeleteSticker(uri) {
                        bottomSheet.dismiss()
                        showStickerTray()
                    }
                }
            )
        }

        root.addView(header)
        root.addView(
            recycler,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        )

        bottomSheet.setContentView(root)
        bottomSheet.show()
    }

    private fun sendSticker(uri: Uri) {
        chatMessageHandler.uploadFileToCloudinary(uri, "image")
    }

    private fun saveStickerUri(uri: Uri) {
        val stickers = loadSavedStickerUris()
            .map { it.toString() }
            .toMutableList()

        val stickerUri = uri.toString()
        if (!stickers.contains(stickerUri)) {
            stickers.add(0, stickerUri)
        }

        while (stickers.size > MAX_SAVED_STICKERS) {
            stickers.removeAt(stickers.lastIndex)
        }

        val json = JSONArray()
        stickers.forEach { json.put(it) }
        getSharedPreferences(STICKER_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SAVED_STICKERS, json.toString())
            .apply()
    }

    private fun removeStickerUri(uri: Uri) {
        val stickerUri = uri.toString()
        val stickers = loadSavedStickerUris()
            .map { it.toString() }
            .filterNot { it == stickerUri }

        val json = JSONArray()
        stickers.forEach { json.put(it) }
        getSharedPreferences(STICKER_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SAVED_STICKERS, json.toString())
            .apply()
    }

    private fun confirmDeleteSticker(uri: Uri, onDeleted: () -> Unit) {
        AlertDialog.Builder(this)
            .setTitle(R.string.delete_sticker_title)
            .setMessage(R.string.delete_sticker_message)
            .setPositiveButton(R.string.delete) { dialog, _ ->
                removeStickerUri(uri)
                dialog.dismiss()
                onDeleted()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun loadSavedStickerUris(): List<Uri> {
        val raw = getSharedPreferences(STICKER_PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SAVED_STICKERS, null)
            ?: return emptyList()

        return runCatching {
            val json = JSONArray(raw)
            buildList {
                for (index in 0 until json.length()) {
                    json.optString(index)
                        .takeIf { it.isNotBlank() }
                        ?.let { add(Uri.parse(it)) }
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }

    private inner class StickerTrayAdapter(
        private val stickers: List<Uri>,
        private val onAddSticker: () -> Unit,
        private val onSendSticker: (Uri) -> Unit,
        private val onDeleteSticker: (Uri) -> Unit
    ) : RecyclerView.Adapter<StickerTrayAdapter.StickerViewHolder>() {

        override fun getItemCount(): Int = stickers.size + 1

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StickerViewHolder {
            val frame = FrameLayout(parent.context).apply {
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dp(82)
                ).apply {
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                }
            }

            val image = ImageView(parent.context).apply {
                id = View.generateViewId()
                scaleType = ImageView.ScaleType.CENTER_CROP
                background = ContextCompat.getDrawable(parent.context, R.drawable.bg_chat_header_icon_button)
                setPadding(dp(10), dp(10), dp(10), dp(10))
            }

            frame.addView(
                image,
                FrameLayout.LayoutParams(dp(72), dp(72), Gravity.CENTER)
            )
            return StickerViewHolder(frame, image)
        }

        override fun onBindViewHolder(holder: StickerViewHolder, position: Int) {
            if (position == 0) {
                holder.image.setImageResource(R.drawable.ic_add)
                holder.image.setColorFilter(ContextCompat.getColor(this@ChatActivity, R.color.yenkasa_emerald))
                holder.itemView.setOnClickListener { onAddSticker() }
                holder.itemView.setOnLongClickListener(null)
                return
            }

            val stickerUri = stickers[position - 1]
            holder.image.clearColorFilter()
            Glide.with(holder.image)
                .load(stickerUri)
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.error_image)
                .into(holder.image)

            holder.itemView.setOnClickListener { onSendSticker(stickerUri) }
            holder.itemView.setOnLongClickListener {
                onDeleteSticker(stickerUri)
                true
            }
        }

        inner class StickerViewHolder(
            itemView: View,
            val image: ImageView
        ) : RecyclerView.ViewHolder(itemView)
    }

    private fun launchCameraCapture() {
        try {
            val photoFile = File.createTempFile("camera_photo_${System.currentTimeMillis()}", ".jpg", cacheDir)
            tempCameraUri = FileProvider.getUriForFile(this, "${applicationContext.packageName}.provider", photoFile)
            tempCameraUri?.let { cameraLauncher.launch(it) }
        } catch (ex: Exception) {
            Log.e("ChatActivity", "Error starting camera capture", ex)
            Toast.makeText(this, getString(R.string.could_not_start_camera_with_error, ex.message.orEmpty()), Toast.LENGTH_LONG).show()
        }
    }

    override fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
    }

    private fun hasAnyPermission(vararg permissions: String): Boolean {
        return permissions.any { hasPermission(it) }
    }

    private fun showChatOptionsMenu(anchorView: View) {
        val popup = PopupMenu(this, anchorView)
        popup.menu.add(0, MENU_CHANGE_BACKGROUND, 0, getString(R.string.change_chat_background))
        popup.menu.add(0, MENU_VIEW_CONTACT, 1, getString(if (isGroupChat) R.string.view_group_profile else R.string.view_contact))
        if (isGroupChat) {
            if (currentGroupDetails?.let { canManageGroup(it) } == true) {
                popup.menu.add(0, MENU_ADD_GROUP_MEMBERS, 2, getString(R.string.add_members))
                popup.menu.add(0, MENU_DELETE_GROUP, 3, getString(R.string.delete_group))
            }
            popup.menu.add(0, MENU_LEAVE_GROUP, 4, getString(R.string.leave_group))
        }
        popup.menu.add(0, MENU_MUTE_NOTIFICATIONS, 5, getString(R.string.mute_notifications))
        popup.menu.add(0, MENU_CLEAR_CHAT, 6, getString(R.string.clear_chat))

        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                MENU_CHANGE_BACKGROUND -> {
                    showChatBackgroundPicker()
                    true
                }
                MENU_VIEW_CONTACT -> {
                    if (isGroupChat) openGroupProfile() else openReceiverProfile()
                    true
                }
                MENU_ADD_GROUP_MEMBERS -> {
                    openGroupAddMembers()
                    true
                }
                MENU_LEAVE_GROUP -> {
                    confirmLeaveGroup()
                    true
                }
                MENU_DELETE_GROUP -> {
                    confirmDeleteGroup()
                    true
                }
                MENU_MUTE_NOTIFICATIONS -> {
                    Toast.makeText(this, R.string.mute_notifications_coming, Toast.LENGTH_SHORT).show()
                    true
                }
                MENU_CLEAR_CHAT -> {
                    Toast.makeText(this, R.string.clear_chat_coming, Toast.LENGTH_SHORT).show()
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun openReceiverProfile() {
        val receiverId = receiverParticipant?._id
        if (receiverId.isNullOrBlank()) {
            Toast.makeText(this, R.string.user_profile_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        startActivity(
            Intent(this, UserProfileActivity::class.java).apply {
                putExtra("USER_ID", receiverId)
            }
        )
    }

    private fun showChatBackgroundPicker() {
        val customImageLabel = getString(R.string.choose_picture_from_device)
        val labels = listOf(customImageLabel) + chatThemePresets.map { getString(it.labelRes) }
        val currentPreset = ChatBackgroundManager.getPreset(this) ?: "default"
        val checkedIndex = if (ChatBackgroundManager.getBackgroundUri(this) != null) {
            0
        } else {
            val presetIndex = chatThemePresets.indexOfFirst { it.key == currentPreset }
                .takeIf { it >= 0 } ?: 0
            presetIndex + 1
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.change_chat_background)
            .setSingleChoiceItems(labels.toTypedArray(), checkedIndex) { dialog, which ->
                if (which == 0) {
                    dialog.dismiss()
                    chatBackgroundImageLauncher.launch(arrayOf("image/*"))
                    return@setSingleChoiceItems
                }

                val selectedPreset = chatThemePresets[which - 1]
                if (selectedPreset.key == "default") {
                    ChatBackgroundManager.clearBackground(this)
                } else {
                    ChatBackgroundManager.savePreset(this, selectedPreset.key)
                }
                applyChatBackground(selectedPreset.key)
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun applySavedChatBackground() {
        ChatBackgroundManager.getBackgroundUri(this)?.let { uri ->
            if (applyCustomChatBackground(uri)) {
                return
            }
            Log.w("ChatActivity", "Saved custom chat background could not be loaded: $uri")
            ChatBackgroundManager.clearBackground(this)
        }

        applyChatBackground(ChatBackgroundManager.getPreset(this) ?: "default")
    }

    private fun applyCustomChatBackground(uri: Uri): Boolean {
        return try {
            val bitmap = contentResolver.openInputStream(uri)?.use { input ->
                BitmapFactory.decodeStream(input)
            } ?: return false

            chatRootLayout.background = BitmapDrawable(resources, bitmap).apply {
                gravity = Gravity.FILL
            }
            true
        } catch (ex: Exception) {
            Log.e("ChatActivity", "Failed to apply custom chat background", ex)
            false
        }
    }

    private fun applyChatBackground(presetKey: String) {
        val preset = chatThemePresets.firstOrNull { it.key == presetKey }
            ?: chatThemePresets.first()

        if (preset.key == "default") {
            chatRootLayout.background = ContextCompat.getDrawable(this, R.drawable.bg_chat_conversation_surface)
            return
        }

        val drawable = when {
            preset.drawableRes != null -> {
                ContextCompat.getDrawable(this, preset.drawableRes)
            }
            preset.colors != null -> {
                GradientDrawable(preset.orientation, preset.colors)
            }
            else -> {
                GradientDrawable().apply {
                    setColor(preset.solidColor ?: Color.WHITE)
                }
            }
        }

        chatRootLayout.background = drawable
    }

    private fun startVideoCall(isVideo: Boolean) {
        val receiverId = receiverParticipant?._id
        val receiverName = receiverParticipant?.username
        val currentUserId = TokenManager.getUserId(this)

        if (receiverId.isNullOrBlank() || currentUserId.isNullOrBlank()) {
            Toast.makeText(this, R.string.missing_user_ids, Toast.LENGTH_SHORT).show()
            return
        }

        if (isVideo && !checkAndRequestPermission(Manifest.permission.CAMERA)) {
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_SHORT).show()
            return
        }

        if (!checkAndRequestPermission(Manifest.permission.RECORD_AUDIO)) {
            Toast.makeText(this, R.string.microphone_permission_required, Toast.LENGTH_SHORT).show()
            return
        }

        val intent = Intent(this, VideoCallActivity::class.java).apply {
            putExtra("CURRENT_USER_ID", currentUserId)
            putExtra("RECEIVER_ID", receiverId)
            putExtra("RECEIVER_NAME", receiverName)
            putExtra("IS_CALLER", true)
            putExtra("IS_VIDEO_CALL", isVideo)
        }

        Log.d("ChatActivity", "Launching VideoCallActivity with CURRENT_USER_ID=$currentUserId, RECEIVER_ID=$receiverId")
        startActivity(intent)
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
                showReplyPreview(message)
                messageAdapter.notifyItemChanged(position)
            }
        }

        val itemTouchHelper = ItemTouchHelper(swipeToReplyCallback)
        itemTouchHelper.attachToRecyclerView(recyclerView)
    }

    private fun setupKeyboardAwareChatInput() {
        val receiverHeaderLayout = findViewById<View>(R.id.receiverHeaderLayout)
        val messageInputLayout = findViewById<View>(R.id.messageInputLayout)
        val emojiShortcut = findViewById<View>(R.id.buttonEmojiShortcut)
        val stickerShortcut = findViewById<View>(R.id.buttonStickerShortcut)
        val laughShortcut = findViewById<View>(R.id.buttonLaughReaction)
        val originalRecyclerStartPadding = recyclerView.paddingStart
        val originalRecyclerEndPadding = recyclerView.paddingEnd
        val originalRecyclerBottomPadding = recyclerView.paddingBottom
        val headerMargins = receiverHeaderLayout.marginSnapshot()
        val inputMargins = messageInputLayout.marginSnapshot()
        val replyMargins = replyPreviewLayout.marginSnapshot()
        val mediaPreviewMargins = mediaPreviewLayout.marginSnapshot()
        val attachMenuMargins = attachMenu.marginSnapshot()
        val emojiMargins = emojiShortcut.marginSnapshot()
        val stickerMargins = stickerShortcut.marginSnapshot()
        val laughMargins = laughShortcut.marginSnapshot()
        val sideComfort = dp(22)
        val headerTopComfort = dp(12)
        val bottomComfort = dp(14)
        var wasKeyboardVisible = false

        ViewCompat.setOnApplyWindowInsetsListener(chatRootLayout) { _, insets ->
            val statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            val navigationBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
            val cutoutInsets = insets.getInsets(WindowInsetsCompat.Type.displayCutout())
            val safeLeft = maxOf(navigationBars.left, cutoutInsets.left)
            val safeRight = maxOf(navigationBars.right, cutoutInsets.right)
            val safeTop = maxOf(statusBarTop, cutoutInsets.top)
            val startSafeSpacing = sideComfort + safeLeft
            val endSafeSpacing = sideComfort + safeRight
            val bottomSafeSpacing = navigationBars.bottom + bottomComfort

            val isKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val legacyKeyboardOverlap = if (isKeyboardVisible) getKeyboardOverlapHeight() else 0
            val imeKeyboardOverlap = if (isKeyboardVisible) {
                (imeInsets.bottom - navigationBars.bottom).coerceAtLeast(0)
            } else {
                0
            }
            val keyboardOffset = maxOf(legacyKeyboardOverlap, imeKeyboardOverlap.takeIf { legacyKeyboardOverlap > 0 } ?: 0)
            val translationY = -keyboardOffset.toFloat()

            receiverHeaderLayout.updateMargins(
                start = maxOf(headerMargins.start, startSafeSpacing),
                top = headerMargins.top + safeTop + headerTopComfort,
                end = maxOf(headerMargins.end, endSafeSpacing)
            )
            messageInputLayout.updateMargins(
                start = maxOf(inputMargins.start, startSafeSpacing),
                end = maxOf(inputMargins.end, endSafeSpacing),
                bottom = maxOf(inputMargins.bottom, bottomSafeSpacing)
            )
            replyPreviewLayout.updateMargins(
                start = maxOf(replyMargins.start, startSafeSpacing),
                end = maxOf(replyMargins.end, endSafeSpacing)
            )
            mediaPreviewLayout.updateMargins(
                start = maxOf(mediaPreviewMargins.start, startSafeSpacing),
                end = maxOf(mediaPreviewMargins.end, endSafeSpacing)
            )
            attachMenu.updateMargins(
                start = maxOf(attachMenuMargins.start, startSafeSpacing),
                bottom = attachMenuMargins.bottom + navigationBars.bottom
            )
            emojiShortcut.updateMargins(
                start = maxOf(emojiMargins.start, startSafeSpacing),
                bottom = emojiMargins.bottom + navigationBars.bottom
            )
            stickerShortcut.updateMargins(
                end = maxOf(stickerMargins.end, endSafeSpacing),
                bottom = stickerMargins.bottom + navigationBars.bottom
            )
            laughShortcut.updateMargins(
                bottom = laughMargins.bottom + navigationBars.bottom
            )

            messageInputLayout.translationY = translationY
            replyPreviewLayout.translationY = translationY
            attachMenu.translationY = translationY
            emojiShortcut.translationY = translationY
            stickerShortcut.translationY = translationY
            laughShortcut.translationY = translationY
            recyclerView.setPaddingRelative(
                maxOf(originalRecyclerStartPadding, startSafeSpacing),
                recyclerView.paddingTop,
                maxOf(originalRecyclerEndPadding, endSafeSpacing),
                originalRecyclerBottomPadding + bottomSafeSpacing + keyboardOffset
            )

            if (isKeyboardVisible && !wasKeyboardVisible) {
                scrollMessagesToBottomSoon()
            }
            wasKeyboardVisible = isKeyboardVisible

            insets
        }
        ViewCompat.requestApplyInsets(chatRootLayout)

        messageInput.setOnFocusChangeListener { _, hasFocus ->
            if (hasFocus) {
                attachMenu.visibility = View.GONE
                scrollMessagesToBottomSoon()
            }
        }

        messageInput.setOnClickListener {
            attachMenu.visibility = View.GONE
            scrollMessagesToBottomSoon()
        }
    }

    private fun getKeyboardOverlapHeight(): Int {
        val visibleFrame = Rect()
        chatRootLayout.getWindowVisibleDisplayFrame(visibleFrame)

        val rootLocation = IntArray(2)
        chatRootLayout.getLocationOnScreen(rootLocation)
        val rootBottom = rootLocation[1] + chatRootLayout.height

        return (rootBottom - visibleFrame.bottom).coerceAtLeast(0)
    }

    private data class Margins(
        val start: Int,
        val top: Int,
        val end: Int,
        val bottom: Int
    )

    private fun View.marginSnapshot(): Margins {
        val params = layoutParams as? ViewGroup.MarginLayoutParams
        return Margins(
            start = params?.marginStart ?: 0,
            top = params?.topMargin ?: 0,
            end = params?.marginEnd ?: 0,
            bottom = params?.bottomMargin ?: 0
        )
    }

    private fun View.updateMargins(
        start: Int? = null,
        top: Int? = null,
        end: Int? = null,
        bottom: Int? = null
    ) {
        val params = layoutParams as? ViewGroup.MarginLayoutParams ?: return
        var changed = false
        start?.let {
            if (params.marginStart != it) {
                params.marginStart = it
                changed = true
            }
        }
        top?.let {
            if (params.topMargin != it) {
                params.topMargin = it
                changed = true
            }
        }
        end?.let {
            if (params.marginEnd != it) {
                params.marginEnd = it
                changed = true
            }
        }
        bottom?.let {
            if (params.bottomMargin != it) {
                params.bottomMargin = it
                changed = true
            }
        }
        if (changed) {
            layoutParams = params
        }
    }

    private fun scrollMessagesToBottomSoon() {
        recyclerView.postDelayed({
            val lastIndex = messageAdapter.itemCount - 1
            if (lastIndex >= 0) {
                recyclerView.smoothScrollToPosition(lastIndex)
            }
        }, 300)
    }

    private fun setupPresenceListeners() {
        SocketManager.ensureConnected(senderId)
        SocketManager.emitUserConnected(senderId)

        SocketManager.on("getOnlineUsers") { data ->
            val receiverId = receiverParticipant?._id ?: return@on
            val isOnline = isReceiverOnline(data, receiverId)
            runOnUiThread {
                onReceiverParticipantStatusUpdate(
                    isOnline,
                    if (isOnline) "Online" else "Offline"
                )
            }
        }

        SocketManager.on("userStatusChanged") { data ->
            handlePresenceChangedEvent(data)
        }

        SocketManager.on("presence:update") { data ->
            handlePresenceChangedEvent(data)
        }

        SocketManager.requestOnlineUsers()
    }

    private fun setupRealtimeMessageListeners() {
        SocketManager.ensureConnected(senderId)
        joinRealtimeChatRoom()

        SocketManager.on("messageCreated") { data ->
            val incoming = parseSocketMessage(data) ?: return@on
            if (incoming.roomId != roomId) return@on
            runOnUiThread {
                upsertRealtimeMessage(incoming)
                if (isIncomingMessageFromOtherUser(incoming)) {
                    if (incoming.isLaughReaction()) {
                        playLaughReactionSound()
                        showLaughReactionAnimation()
                    } else {
                        playInChatMessageSound()
                    }
                }
                if (::chatActivityHelper.isInitialized) {
                    chatActivityHelper.markRoomAsRead()
                }
            }
        }

        SocketManager.on("messageEdited") { data ->
            val edited = parseSocketMessage(data) ?: return@on
            if (edited.roomId != roomId) return@on
            runOnUiThread { upsertRealtimeMessage(edited) }
        }

        SocketManager.on("messageDeleted") { data ->
            val json = parseSocketJson(data) ?: return@on
            if (json.optString("roomId") != roomId) return@on
            val deletedMessageId = json.optString("messageId")
            if (deletedMessageId.isBlank()) return@on
            runOnUiThread {
                val updatedMessages = messageAdapter.currentList
                    .filterNot { it.id == deletedMessageId }
                updateMessages(updatedMessages)
            }
        }

    }

    private fun joinRealtimeChatRoom() {
        val activeRoomId = roomId ?: return
        val payload = JSONObject()
            .put("roomId", activeRoomId)
            .put("userId", senderId)
        SocketManager.emit("joinChatRoom", payload)
    }

    private fun leaveRealtimeChatRoom() {
        val activeRoomId = roomId ?: return
        SocketManager.emit("leaveChatRoom", activeRoomId)
    }

    private fun sendLaughReaction() {
        val now = SystemClock.elapsedRealtime()
        if (now - lastLaughReactionSentAt < LAUGH_REACTION_COOLDOWN_MS) return

        val activeRoomId = roomId ?: return
        lastLaughReactionSentAt = now
        showLaughReactionAnimation()
        chatMessageHandler.sendMessage(
            mapOf(
                "text" to LAUGH_REACTION_TEXT_MARKER,
                "messageType" to LAUGH_REACTION_MESSAGE_TYPE
            )
        )
    }

    private fun initializeChatSoundEffects() {
        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        soundPool = SoundPool.Builder()
            .setMaxStreams(2)
            .setAudioAttributes(attributes)
            .build()
            .also { pool ->
                pool.setOnLoadCompleteListener { _, sampleId, status ->
                    if (status == 0) loadedSoundIds.add(sampleId)
                }
                inChatMessageSoundId = pool.load(this, R.raw.in_chat_message, 1)
                laughReactionSoundId = pool.load(this, R.raw.chat_laugh_reaction, 1)
            }
    }

    private fun playInChatMessageSound() {
        if (!isChatVisible || !isInChatSoundsEnabled()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastInChatMessageSoundAt < IN_CHAT_MESSAGE_SOUND_COOLDOWN_MS) return
        lastInChatMessageSoundAt = now
        playChatSound(inChatMessageSoundId, R.raw.in_chat_message)
    }

    private fun playLaughReactionSound() {
        if (!isChatVisible || !isReactionSoundsEnabled()) return
        val now = SystemClock.elapsedRealtime()
        if (now - lastLaughReactionPlayedAt < LAUGH_REACTION_COOLDOWN_MS) return
        lastLaughReactionPlayedAt = now
        playChatSound(laughReactionSoundId, R.raw.chat_laugh_reaction)
    }

    private fun playChatSound(soundId: Int, rawFallbackRes: Int) {
        val pool = soundPool
        if (pool != null && soundId != 0 && loadedSoundIds.contains(soundId)) {
            pool.play(soundId, 1f, 1f, 1, 0, 1f)
            return
        }

        runCatching {
            MediaPlayer.create(this, rawFallbackRes)?.apply {
                setOnCompletionListener { player -> player.release() }
                setOnErrorListener { player, _, _ ->
                    player.release()
                    true
                }
                start()
            }
        }.onFailure { error ->
            Log.w("ChatActivity", "Unable to play chat sound: ${error.message}")
        }
    }

    private fun releaseChatSoundEffects() {
        soundPool?.release()
        soundPool = null
        loadedSoundIds.clear()
        inChatMessageSoundId = 0
        laughReactionSoundId = 0
    }

    private fun isInChatSoundsEnabled(): Boolean {
        return getSharedPreferences(CHAT_SOUND_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_IN_CHAT_MESSAGE_SOUNDS_ENABLED, true)
    }

    private fun isReactionSoundsEnabled(): Boolean {
        return getSharedPreferences(CHAT_SOUND_PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_REACTION_SOUNDS_ENABLED, true)
    }

    private fun showLaughReactionAnimation() {
        val rootWidth = chatRootLayout.width.takeIf { it > 0 } ?: return
        repeat(3) { index ->
            val bubble = TextView(this).apply {
                text = getString(R.string.laugh_reaction_emoji)
                textSize = 28f
                alpha = 0f
                gravity = Gravity.CENTER
            }
            val size = dp(48)
            val leftMargin = (rootWidth / 2) - (size / 2) + dp((index - 1) * 28)
            val bottomMargin = dp(142 + index * 12)
            val params = FrameLayout.LayoutParams(size, size, Gravity.BOTTOM or Gravity.START).apply {
                marginStart = leftMargin.coerceAtLeast(dp(12))
                setMargins(marginStart, 0, 0, bottomMargin)
            }
            chatRootLayout.addView(bubble, params)
            bubble.animate()
                .alpha(1f)
                .translationY(-dp(86 + index * 12).toFloat())
                .setStartDelay((index * 90).toLong())
                .setDuration(760L)
                .withEndAction { chatRootLayout.removeView(bubble) }
                .start()
        }
    }

    private fun parseSocketJson(data: Any): JSONObject? {
        return when (data) {
            is JSONObject -> data
            else -> runCatching { JSONObject(data.toString()) }.getOrNull()
        }
    }

    private fun parseSocketMessage(data: Any): ChatMessage? {
        val json = parseSocketJson(data) ?: return null
        return runCatching {
            chatMessageGson.fromJson(json.toString(), ChatMessage::class.java)
        }.getOrNull()
    }

    private fun isIncomingMessageFromOtherUser(message: ChatMessage): Boolean {
        val messageSenderId = message.senderId ?: message.sender?._id
        return !messageSenderId.isNullOrBlank() && messageSenderId != senderId
    }

    private fun ChatMessage.isLaughReaction(): Boolean {
        return messageType == LAUGH_REACTION_MESSAGE_TYPE || text == LAUGH_REACTION_TEXT_MARKER
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

    private fun handlePresenceChangedEvent(data: Any) {
        val json = when (data) {
            is JSONObject -> data
            else -> runCatching { JSONObject(data.toString()) }.getOrNull()
        } ?: return

        val updatedUserId = json.optString("userId", json.optString("_id", ""))
        val receiverId = receiverParticipant?._id ?: return
        if (updatedUserId != receiverId) return

        val isOnline = json.optBoolean("isOnline", json.optBoolean("online", false))
        val statusText = json.optString(
            "statusText",
            if (isOnline) "Online" else "Offline"
        )

        runOnUiThread {
            onReceiverParticipantStatusUpdate(isOnline, statusText)
        }
    }

    private fun refreshReceiverPresence() {
        val receiverId = receiverParticipant?._id ?: return

        ApiClient.apiService.getUserPresence(receiverId)
            .enqueue(object : Callback<PresenceResponse> {
                override fun onResponse(
                    call: Call<PresenceResponse>,
                    response: Response<PresenceResponse>
                ) {
                    val presence = response.body()
                    if (!response.isSuccessful || presence == null) {
                        Log.w("ChatActivity", "Presence refresh failed: ${response.code()}")
                        return
                    }

                    val isOnline = presence.resolvedOnline
                    runOnUiThread {
                        onReceiverParticipantStatusUpdate(
                            isOnline,
                            presence.statusText ?: if (isOnline) "Online" else "Offline"
                        )
                    }
                }

                override fun onFailure(
                    call: Call<PresenceResponse>,
                    t: Throwable
                ) {
                    Log.w("ChatActivity", "Presence refresh error: ${t.message}")
                }
            })
    }

    private fun parseOnlineUsersArray(data: Any): JSONArray? {
        return when (data) {
            is JSONArray -> data
            is JSONObject -> {
                data.optJSONArray("onlineUsers")
                    ?: data.optJSONArray("users")
                    ?: data.optJSONArray("userIds")
            }
            else -> runCatching { JSONArray(data.toString()) }.getOrNull()
        }
    }

    private fun isReceiverOnline(data: Any, receiverId: String): Boolean {
        if (data is JSONObject) {
            val eventUserId = data.optString("userId", data.optString("_id", ""))
            if (eventUserId == receiverId) {
                return data.optBoolean("isOnline", data.optBoolean("online", false))
            }
        }

        parseOnlineUsersArray(data)?.let { onlineUsers ->
            for (i in 0 until onlineUsers.length()) {
                when (val item = onlineUsers.opt(i)) {
                    is JSONObject -> {
                        val id = item.optString("userId", item.optString("_id", item.optString("id", "")))
                        if (id == receiverId) return true
                    }
                    else -> if (item?.toString() == receiverId) return true
                }
            }
            return false
        }

        return when (data) {
            is List<*> -> data.any { it?.toString() == receiverId }
            is Array<*> -> data.any { it?.toString() == receiverId }
            else -> data.toString()
                .removePrefix("[")
                .removeSuffix("]")
                .split(",")
                .map { it.trim().trim('"') }
                .contains(receiverId)
        }
    }

    private fun showReplyPreview(message: ChatMessage) {
        replyingToMessage = message
        replyPreviewLayout.visibility = View.VISIBLE

        val senderName = if (message.sender?._id == senderId) getString(R.string.you) else textViewReceiverName.text.toString()
        textViewRepliedToName.text = getString(R.string.replying_to, senderName)
        textViewRepliedToMessage.text = message.text ?: getString(R.string.media_message)

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
        receiverParticipant = participant // <-- Save the participant
        updateReceiverHeader(participant)
        onReceiverParticipantStatusUpdate(
            participant.resolvedOnline,
            getString(if (participant.resolvedOnline) R.string.online else R.string.offline)
        )
        refreshReceiverPresence()
        SocketManager.requestOnlineUsers()
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
        textViewReceiverName.text = defaultName ?: getString(R.string.chat)
        if (::imageViewReceiverPicture.isInitialized) {
            val groupImage = intent.getStringExtra("groupImage").orEmpty()
            if (isGroupChat && groupImage.isNotBlank()) {
                Glide.with(this)
                    .load(groupImage)
                    .placeholder(R.drawable.ic_default_profile)
                    .error(R.drawable.ic_default_profile)
                    .into(imageViewReceiverPicture)
            } else {
                imageViewReceiverPicture.setImageResource(R.drawable.ic_default_profile)
            }
        }
        val memberCount = intent.getIntExtra("groupMemberCount", 0)
        textViewOnlineStatus.text = if (isGroupChat) {
            if (memberCount > 0) resources.getQuantityString(R.plurals.members_count, memberCount, memberCount) else getString(R.string.group_chat)
        } else {
            ""
        }
        imageViewStatusIndicator.visibility = View.GONE
    }

    private fun configureGroupHeaderIfNeeded() {
        if (!isGroupChat) return
        callButton.visibility = View.GONE
        videoCallButton.visibility = View.GONE
        imageViewStatusIndicator.visibility = View.GONE
        textViewOnlineStatus.text = getString(R.string.group_chat)
        refreshGroupHeader()
    }

    private fun openGroupProfile() {
        val groupId = roomId
        if (groupId.isNullOrBlank()) {
            Toast.makeText(this, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(Intent(this, GroupProfileActivity::class.java).apply {
            putExtra("groupId", groupId)
            putExtra("groupName", textViewReceiverName.text?.toString().orEmpty())
            putExtra("groupImage", intent.getStringExtra("groupImage").orEmpty())
            putExtra("groupMemberCount", intent.getIntExtra("groupMemberCount", 0))
        })
    }

    private fun openGroupAddMembers() {
        val group = currentGroupDetails
        if (group == null) {
            Toast.makeText(this, R.string.group_details_still_loading, Toast.LENGTH_SHORT).show()
            return
        }
        startActivity(Intent(this, GroupContactsSelectorActivity::class.java).apply {
            putExtra("mode", "addMembers")
            putExtra("groupId", group._id)
            putStringArrayListExtra(
                "existingMemberIds",
                ArrayList(group.participants.orEmpty().map { it._id })
            )
        })
    }

    private fun confirmLeaveGroup() {
        val groupId = roomId
        if (groupId.isNullOrBlank()) {
            Toast.makeText(this, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.leave_group_title)
            .setMessage(getString(R.string.leave_group_message, getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.leave) { _, _ ->
                ApiClient.apiService.leaveGroup(groupId).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@ChatActivity, response.body()?.message ?: getString(R.string.could_not_leave_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@ChatActivity, R.string.you_left_group, Toast.LENGTH_SHORT).show()
                        finish()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(this@ChatActivity, getString(R.string.could_not_leave_group_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                    }
                })
            }
            .show()
    }

    private fun confirmDeleteGroup() {
        val groupId = roomId
        if (groupId.isNullOrBlank()) {
            Toast.makeText(this, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle(R.string.delete_group_title)
            .setMessage(getString(R.string.delete_group_message, getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.delete) { _, _ ->
                ApiClient.apiService.deleteGroup(groupId).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@ChatActivity, response.body()?.message ?: getString(R.string.could_not_delete_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@ChatActivity, R.string.group_deleted, Toast.LENGTH_SHORT).show()
                        finish()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(this@ChatActivity, getString(R.string.could_not_delete_group_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                    }
                })
            }
            .show()
    }

    private fun canManageGroup(group: ChatRoom): Boolean {
        val currentUserId = TokenManager.getUserId(this).orEmpty()
        return currentUserId.isNotBlank() &&
            (group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId))
    }

    private fun refreshGroupHeader() {
        val groupId = roomId ?: return
        ApiClient.apiService.getSingleGroup(groupId).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                val group = response.body()?.group ?: return
                if (!response.isSuccessful) return
                currentGroupDetails = group
                textViewReceiverName.text = group.groupName ?: textViewReceiverName.text
                textViewOnlineStatus.text = if (group.memberCount > 0) "${group.memberCount} members" else "Group chat"
                val imageUrl = group.groupImage.orEmpty()
                if (imageUrl.isNotBlank()) {
                    Glide.with(this@ChatActivity)
                        .load(imageUrl)
                        .placeholder(R.drawable.ic_default_profile)
                        .error(R.drawable.ic_default_profile)
                        .into(imageViewReceiverPicture)
                }
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                Log.w("ChatActivity", "Could not refresh group header: ${t.message}")
            }
        })
    }

    override fun showToast(message: String, length: Int) {
        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) {
            Log.d("ChatActivity", "Suppressing background toast: $message")
            return
        }
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
            .setTitle(R.string.delete_message_title)
            .setMessage(getString(R.string.delete_message_confirmation, messageToDelete.text ?: getString(R.string.media_message)))
            .setPositiveButton(R.string.delete) { dialog, _ ->
                lifecycleScope.launch {
                    chatActivityHelper.confirmDeleteMessageOnServer(messageToDelete)
                }
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel) { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }

    override fun requestEditMessage(messageToEdit: ChatMessage, positionInAdapter: Int) {
        if (messageToEdit.sender?._id != senderId && messageToEdit.senderId != senderId) {
            Toast.makeText(this, R.string.edit_own_messages_only, Toast.LENGTH_SHORT).show()
            return
        }

        val currentText = messageToEdit.text.orEmpty()
        if (currentText.isBlank()) {
            Toast.makeText(this, R.string.only_text_messages_can_be_edited, Toast.LENGTH_SHORT).show()
            return
        }

        val editText = EditText(this).apply {
            setText(currentText)
            setSelection(text.length)
            minLines = 2
            maxLines = 5
            inputType = InputType.TYPE_CLASS_TEXT or
                    InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                    InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.edit_message_title)
            .setView(editText)
            .setPositiveButton(R.string.save, null)
            .setNegativeButton(R.string.cancel, null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val nextText = editText.text.toString().trim()
                when {
                    nextText.isBlank() -> {
                        Toast.makeText(this, R.string.message_cannot_be_empty, Toast.LENGTH_SHORT).show()
                    }
                    nextText == currentText -> dialog.dismiss()
                    else -> {
                        lifecycleScope.launch {
                            chatActivityHelper.confirmEditMessageOnServer(messageToEdit, nextText)
                        }
                        dialog.dismiss()
                    }
                }
            }
        }

        dialog.show()
        editText.requestFocus()
        dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
    }

    override fun requestReplyToMessage(message: ChatMessage) {
        showReplyPreview(message)
    }

    override fun requestForwardMessage(message: ChatMessage) {
        if (!hasForwardableContent(message)) {
            Toast.makeText(this, R.string.message_cannot_be_forwarded, Toast.LENGTH_SHORT).show()
            return
        }

        Toast.makeText(this, R.string.loading_contacts, Toast.LENGTH_SHORT).show()
        ApiClient.apiService.getContacts().enqueue(object : Callback<List<Contact>> {
            override fun onResponse(call: Call<List<Contact>>, response: Response<List<Contact>>) {
                if (!response.isSuccessful) {
                    Toast.makeText(
                        this@ChatActivity,
                        getString(R.string.could_not_load_contacts_with_error, parseError(response)),
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                val contacts = response.body().orEmpty()
                if (contacts.isEmpty()) {
                    Toast.makeText(this@ChatActivity, R.string.no_contacts_to_forward_to, Toast.LENGTH_SHORT).show()
                    return
                }

                showForwardContactPicker(message, contacts)
            }

            override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                Toast.makeText(this@ChatActivity, getString(R.string.could_not_load_contacts_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun showForwardContactPicker(message: ChatMessage, contacts: List<Contact>) {
        val labels = contacts.map { contact ->
            if (contact.location.isBlank()) contact.username else "${contact.username} - ${contact.location}"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(R.string.forward_to)
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                forwardMessageToContact(message, contacts[which])
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun forwardMessageToContact(message: ChatMessage, contact: Contact) {
        Toast.makeText(this, getString(R.string.forwarding_to, contact.username), Toast.LENGTH_SHORT).show()
        ApiClient.apiService.createChatRoom(CreateChatRoomRequest(username = contact.username))
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val targetRoomId = response.body()?.roomId
                    if (!response.isSuccessful || targetRoomId.isNullOrBlank()) {
                        Toast.makeText(
                            this@ChatActivity,
                            getString(R.string.could_not_open_chat_with_error, response.body()?.message ?: parseError(response)),
                            Toast.LENGTH_LONG
                        ).show()
                        return
                    }

                    sendForwardedMessage(message, targetRoomId, contact.username)
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@ChatActivity, getString(R.string.could_not_open_chat_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                }
            })
    }

    private fun sendForwardedMessage(message: ChatMessage, targetRoomId: String, targetName: String) {
        val payload = buildForwardPayload(message, targetRoomId).toMutableMap()
        if (payload.isEmpty()) {
            Toast.makeText(this, R.string.message_cannot_be_forwarded, Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.sendMessage(payload).enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful) {
                    Toast.makeText(this@ChatActivity, getString(R.string.forwarded_to, targetName), Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this@ChatActivity,
                        getString(R.string.forward_failed_with_error, parseError(response)),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Toast.makeText(this@ChatActivity, getString(R.string.forward_failed_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun buildForwardPayload(message: ChatMessage, targetRoomId: String?): Map<String, Any?> {
        val payload = mutableMapOf<String, Any?>()
        targetRoomId?.let { payload["roomId"] = it }
        payload["senderId"] = senderId
        com.onesignal.OneSignal.getDeviceState()?.userId?.let { playerId ->
            if (playerId.isNotBlank()) payload["playerId"] = playerId
        }

        message.text?.takeIf { it.isNotBlank() }?.let { payload["text"] = it }
        message.imageUrl?.takeIf { it.isNotBlank() }?.let { payload["imageUrl"] = it }
        message.audioUrl?.takeIf { it.isNotBlank() }?.let { payload["audioUrl"] = it }
        message.videoUrl?.takeIf { it.isNotBlank() }?.let { payload["videoUrl"] = it }
        message.fileUrl?.takeIf { it.isNotBlank() }?.let { payload["fileUrl"] = it }
        message.contactInfo?.takeIf { it.isNotBlank() }?.let { payload["contactInfo"] = it }
        message.location?.let {
            payload["location"] = mapOf("latitude" to it.latitude, "longitude" to it.longitude)
        }

        return payload.filterKeys { key ->
            key == "roomId" ||
                key == "senderId" ||
                key == "playerId" ||
                key == "text" ||
                key == "imageUrl" ||
                key == "audioUrl" ||
                key == "videoUrl" ||
                key == "fileUrl" ||
                key == "contactInfo" ||
                key == "location"
        }.filterValues { value -> value != null }
    }

    private fun hasForwardableContent(message: ChatMessage): Boolean {
        return !message.text.isNullOrBlank() ||
            !message.imageUrl.isNullOrBlank() ||
            !message.audioUrl.isNullOrBlank() ||
            !message.videoUrl.isNullOrBlank() ||
            !message.fileUrl.isNullOrBlank() ||
            !message.contactInfo.isNullOrBlank() ||
            message.location != null
    }

    override fun onMessageSent(message: ChatMessage) {
        Log.d(
            "ChatActivity",
            "Message sent callback: id=${message.id}, image=${message.imageUrl}, video=${message.videoUrl}, file=${message.fileUrl}, text=${message.text}"
        )
        if (isUploadingPendingMedia) {
            clearPendingMediaPreview()
        }
        chatActivityHelper.onMessageSentByHandler(message)
        if (isUploadingMediaQueue) {
            uploadNextQueuedMedia()
        }
    }

    override fun onError(error: String) {
        chatActivityHelper.onErrorFromHandler(error)
        resetFailedOutgoingState()
    }

    override fun onSendRejected(code: Int, reason: String?, message: String) {
        if (code == 423 && reason == "requires_approval") {
            sendMessageApprovalRequest(message)
            resetFailedOutgoingState()
            return
        }

        onError(message)
    }

    private fun sendMessageApprovalRequest(fallbackMessage: String) {
        val receiverId = receiverParticipant?._id
        if (receiverId.isNullOrBlank()) {
            Toast.makeText(this, fallbackMessage, Toast.LENGTH_LONG).show()
            return
        }

        ApiClient.apiService.sendMessageRequest(MessageRequest(receiverId, null))
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (response.isSuccessful) {
                        Toast.makeText(
                            this@ChatActivity,
                            "Message request sent. You can chat after they approve it.",
                            Toast.LENGTH_LONG
                        ).show()
                    } else {
                        Toast.makeText(this@ChatActivity, parseError(response), Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Toast.makeText(
                        this@ChatActivity,
                        "Could not send message request: ${t.message}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }

    private fun resetFailedOutgoingState() {
        if (isUploadingPendingMedia) {
            isUploadingPendingMedia = false
            updateComposerActionButtons()
            textMediaPreviewSubtitle.text = getString(R.string.chat_media_preview_failed)
        }
        if (isUploadingMediaQueue) {
            isUploadingMediaQueue = false
            outgoingMediaQueue.clear()
            updateComposerActionButtons()
            Toast.makeText(this, R.string.chat_media_batch_failed, Toast.LENGTH_SHORT).show()
        }
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

    private fun parseError(response: Response<*>): String {
        return try {
            val rawError = response.errorBody()?.string()?.ifBlank { null }
            if (response.code() == 403 && rawError?.contains("blocked", ignoreCase = true) == true) {
                "You can’t send this message because this user has blocked you."
            } else {
                rawError ?: "Error ${response.code()} ${response.message()}"
            }
        } catch (e: IOException) {
            "Error ${response.code()}"
        }
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

    companion object {
        private const val MENU_CHANGE_BACKGROUND = 1
        private const val MENU_VIEW_CONTACT = 2
        private const val MENU_MUTE_NOTIFICATIONS = 3
        private const val MENU_CLEAR_CHAT = 4
        private const val MENU_ADD_GROUP_MEMBERS = 5
        private const val MENU_LEAVE_GROUP = 6
        private const val MENU_DELETE_GROUP = 7
        private const val STICKER_PREFS = "chat_stickers"
        private const val KEY_SAVED_STICKERS = "saved_sticker_uris"
        private const val MAX_SAVED_STICKERS = 36
        private const val LAUGH_REACTION_MESSAGE_TYPE = "laugh_reaction"
        private const val LAUGH_REACTION_TEXT_MARKER = "__YK_LAUGH_REACTION__"
        private const val CHAT_SOUND_PREFS = "chat_sound_settings"
        private const val KEY_IN_CHAT_MESSAGE_SOUNDS_ENABLED = "in_chat_message_sounds_enabled"
        private const val KEY_REACTION_SOUNDS_ENABLED = "reaction_sounds_enabled"
        private const val IN_CHAT_MESSAGE_SOUND_COOLDOWN_MS = 450L
        private const val LAUGH_REACTION_COOLDOWN_MS = 2500L
    }
}
