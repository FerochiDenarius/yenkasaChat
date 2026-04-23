package xyz.yenkasa.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.ContactsContract
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
import com.google.android.material.bottomsheet.BottomSheetDialog
import xyz.yenkasa.app.R
import xyz.yenkasa.app.webrtc.VideoCallActivity
import xyz.yenkasa.app.adapter.MessageAdapter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.Contact
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.model.PresenceResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.network.SocketManager
import xyz.yenkasa.app.util.ChatBackgroundManager
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

class ChatActivity : AppCompatActivity(), ChatHelperCallback, ChatMessageHandler.ChatMessageCallback, MessageAdapter.OnMessageLongClickListener {

    private lateinit var recyclerView: RecyclerView
    private lateinit var messageInput: RichContentEditText
    private lateinit var sendButton: ImageButton
    private lateinit var micButton: ImageButton
    private lateinit var attachButton: ImageButton
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
    private var tempCameraUri: Uri? = null
    private var pendingMediaUri: Uri? = null
    private var pendingMediaType: String? = null
    private var isUploadingPendingMedia: Boolean = false
    private var pendingPermissionAction: (() -> Unit)? = null
    private var replyingToMessage: ChatMessage? = null
    private lateinit var callButton: ImageView
    private lateinit var videoCallButton: ImageView
    private val webSocketManager = WebSocketProvider.instance
    private var receiverParticipant: Participant? = null

    private val uiHandler = Handler(Looper.getMainLooper())

    private data class ChatThemePreset(
        val key: String,
        val label: String,
        val colors: IntArray?,
        val orientation: GradientDrawable.Orientation = GradientDrawable.Orientation.TL_BR,
        val solidColor: Int? = null,
        val drawableRes: Int? = null
    )

    private val chatThemePresets = listOf(
        ChatThemePreset(
            "default",
            "Yenkasa default",
            null
        ),
        ChatThemePreset(
            "africa_skyline_dark",
            "Africa skyline dark",
            null,
            drawableRes = R.drawable.chat_theme_africa_skyline_dark
        ),
        ChatThemePreset(
            "softotech_light",
            "Soft-O-Tech light",
            null,
            drawableRes = R.drawable.chat_theme_softotech_light
        ),
        ChatThemePreset(
            "yenkasa_cream",
            "Yenkasa cream",
            null,
            drawableRes = R.drawable.chat_theme_yenkasa_cream
        ),
        ChatThemePreset(
            "africa_network_blue",
            "Africa network blue",
            null,
            drawableRes = R.drawable.chat_theme_africa_network_blue
        ),
        ChatThemePreset(
            "ykc_gold_dark",
            "YKC gold dark",
            null,
            drawableRes = R.drawable.chat_theme_ykc_gold_dark
        ),
        ChatThemePreset(
            "savanna_green",
            "Savanna green",
            null,
            drawableRes = R.drawable.chat_theme_savanna_green
        ),
        ChatThemePreset(
            "whatsapp_light",
            "WhatsApp light",
            intArrayOf(Color.parseColor("#EFE7DC"), Color.parseColor("#DDEEDB")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "whatsapp_dark",
            "WhatsApp dark",
            intArrayOf(Color.parseColor("#0B141A"), Color.parseColor("#1F2C34")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "cool_mint",
            "Cool mint",
            intArrayOf(Color.parseColor("#D9F7E8"), Color.parseColor("#EAF8FF")),
            GradientDrawable.Orientation.TOP_BOTTOM
        ),
        ChatThemePreset(
            "ocean",
            "Ocean",
            intArrayOf(Color.parseColor("#D8F3F5"), Color.parseColor("#BFD7EA")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "sunset",
            "Sunset",
            intArrayOf(Color.parseColor("#FDE2D2"), Color.parseColor("#F7D6E0")),
            GradientDrawable.Orientation.TL_BR
        ),
        ChatThemePreset(
            "graphite",
            "Graphite",
            intArrayOf(Color.parseColor("#202124"), Color.parseColor("#3C4043")),
            GradientDrawable.Orientation.TOP_BOTTOM
        )
    )

    // --- Activity Result Launchers ---
    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { showPendingMediaPreview(it, "image") }
    }

    private val videoPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        uri?.let { showPendingMediaPreview(it, "video") }
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
            Toast.makeText(this, "Chat background updated.", Toast.LENGTH_SHORT).show()
        } else {
            ChatBackgroundManager.clearBackground(this)
            applyChatBackground("default")
            Toast.makeText(this, "Could not use that image.", Toast.LENGTH_SHORT).show()
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
        Toast.makeText(this, "Sticker saved. Tap it to send.", Toast.LENGTH_SHORT).show()
        showStickerTray()
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        if (success) {
            val imageUri = tempCameraUri
            if (imageUri == null) {
                Toast.makeText(this, "Camera image was not saved. Try again.", Toast.LENGTH_LONG).show()
            } else {
                showPendingMediaPreview(imageUri, "image")
            }
        } else {
            Toast.makeText(this, "Photo cancelled.", Toast.LENGTH_SHORT).show()
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

        if (!retrieveSessionAndValidate()) {
            return // Exit if session is not valid
        }

        // --- Initialize handlers and helpers ---
        chatMessageHandler = ChatMessageHandler(this, this, token, senderId, roomId!!)

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        messageAdapter = MessageAdapter(
            currentUserId = senderId,
            receiverName = textViewReceiverName.text.toString()
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
            Toast.makeText(this, "Error loading chat", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        setupPresenceListeners()

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
        setupKeyboardAwareChatInput()

        // ✅ Now safe: only called after helper initialized
        chatActivityHelper.initializeHeaderInformation()
        chatActivityHelper.startFetchingMessagesRepeatedly()
        requestNeededPermissions()
    }

    override fun onStart() {
        super.onStart()
        webSocketManager.connect(this)
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.startFetchingMessagesRepeatedly()
        }
    }

    override fun onStop() {
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.stopFetchingMessages()
        }
        webSocketManager.release(this)
        super.onStop()
    }

    // --- Add this to prevent the crash ---
    override fun onDestroy() {
        if (::chatActivityHelper.isInitialized) {
            chatActivityHelper.cleanup()
        }
        SocketManager.off("getOnlineUsers")
        SocketManager.off("userStatusChanged")
        super.onDestroy()
    }



    private fun initViews() {
        chatRootLayout = findViewById(R.id.chatRootLayout)
        recyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.btnSend)
        micButton = findViewById(R.id.btnMic)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
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

        buttonCancelReply.setOnClickListener { clearReplyingTo() }

        findViewById<ImageButton>(R.id.buttonAttachImage).setOnClickListener {
            attachMenu.visibility = View.GONE
            imagePickerLauncher.launch("image/*")
        }
        findViewById<ImageButton>(R.id.buttonAttachVideo).setOnClickListener {
            attachMenu.visibility = View.GONE
            videoPickerLauncher.launch("video/*")
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
                Toast.makeText(this, "Audio recording permission needed.", Toast.LENGTH_SHORT).show()
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
        val emojis = arrayOf("😀", "😂", "😊", "😍", "😎", "😢", "🙏", "👍", "🔥", "❤️", "💚", "🎉")
        AlertDialog.Builder(this)
            .setTitle("Choose emoji")
            .setItems(emojis) { dialog, which ->
                insertEmoji(emojis[which])
                dialog.dismiss()
            }
            .setNegativeButton("Cancel", null)
            .show()
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
        textMediaPreviewTitle.text = if (type == "video") "Video ready" else "Photo ready"
        textMediaPreviewSubtitle.text = "Tap send when ready"
        textMediaPreviewPlay.visibility = if (type == "video") View.VISIBLE else View.GONE

        if (type == "video") {
            imageMediaPreview.setImageBitmap(readVideoFrame(uri))
            if (imageMediaPreview.drawable == null) {
                imageMediaPreview.setImageResource(R.drawable.placeholder_image)
            }
        } else {
            imageMediaPreview.setImageURI(uri)
        }

        attachMenu.visibility = View.GONE
        updateComposerActionButtons()
    }

    private fun uploadPendingMedia(caption: String) {
        val uri = pendingMediaUri ?: return
        val type = pendingMediaType ?: return
        if (isUploadingPendingMedia) return

        isUploadingPendingMedia = true
        textMediaPreviewSubtitle.text = "Uploading..."
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
        sendButton.isEnabled = !isUploadingPendingMedia
        sendButton.alpha = if (isUploadingPendingMedia) 0.55f else 1f
        micButton.visibility = if (!hasText && !hasPendingMedia) View.VISIBLE else View.GONE
    }

    private fun readVideoFrame(uri: Uri): android.graphics.Bitmap? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(this, uri)
            retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        } catch (ex: Exception) {
            Log.w("ChatActivity", "Could not read video preview frame", ex)
            null
        } finally {
            runCatching { retriever.release() }
        }
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
            .setTitle("Delete sticker?")
            .setMessage("Remove this sticker from your saved stickers on this device.")
            .setPositiveButton("Delete") { dialog, _ ->
                removeStickerUri(uri)
                dialog.dismiss()
                onDeleted()
            }
            .setNegativeButton("Cancel", null)
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
            cameraLauncher.launch(tempCameraUri)
        } catch (ex: Exception) {
            Log.e("ChatActivity", "Error starting camera capture", ex)
            Toast.makeText(this, "Could not start camera: ${ex.message}", Toast.LENGTH_LONG).show()
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
        popup.menu.add(0, MENU_CHANGE_BACKGROUND, 0, "Change chat background")
        popup.menu.add(0, MENU_VIEW_CONTACT, 1, "View contact")
        popup.menu.add(0, MENU_MUTE_NOTIFICATIONS, 2, "Mute notifications")
        popup.menu.add(0, MENU_CLEAR_CHAT, 3, "Clear chat")

        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                MENU_CHANGE_BACKGROUND -> {
                    showChatBackgroundPicker()
                    true
                }
                MENU_VIEW_CONTACT -> {
                    Toast.makeText(this, "View contact will be added next.", Toast.LENGTH_SHORT).show()
                    true
                }
                MENU_MUTE_NOTIFICATIONS -> {
                    Toast.makeText(this, "Mute notifications will be added next.", Toast.LENGTH_SHORT).show()
                    true
                }
                MENU_CLEAR_CHAT -> {
                    Toast.makeText(this, "Clear chat will be added next.", Toast.LENGTH_SHORT).show()
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private fun showChatBackgroundPicker() {
        val customImageLabel = "Choose picture from device"
        val labels = listOf(customImageLabel) + chatThemePresets.map { it.label }
        val currentPreset = ChatBackgroundManager.getPreset(this) ?: "default"
        val checkedIndex = if (ChatBackgroundManager.getBackgroundUri(this) != null) {
            0
        } else {
            val presetIndex = chatThemePresets.indexOfFirst { it.key == currentPreset }
                .takeIf { it >= 0 } ?: 0
            presetIndex + 1
        }

        AlertDialog.Builder(this)
            .setTitle("Change chat background")
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
            .setNegativeButton("Cancel", null)
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
            Toast.makeText(this, "Missing user IDs.", Toast.LENGTH_SHORT).show()
            return
        }

        if (isVideo && !checkAndRequestPermission(Manifest.permission.CAMERA)) {
            Toast.makeText(this, "Camera permission required.", Toast.LENGTH_SHORT).show()
            return
        }

        if (!checkAndRequestPermission(Manifest.permission.RECORD_AUDIO)) {
            Toast.makeText(this, "Microphone permission required.", Toast.LENGTH_SHORT).show()
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
        val messageInputLayout = findViewById<View>(R.id.messageInputLayout)
        val emojiShortcut = findViewById<View>(R.id.buttonEmojiShortcut)
        val stickerShortcut = findViewById<View>(R.id.buttonStickerShortcut)
        val originalRecyclerBottomPadding = recyclerView.paddingBottom
        var wasKeyboardVisible = false

        ViewCompat.setOnApplyWindowInsetsListener(chatRootLayout) { _, insets ->
            val isKeyboardVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
            val keyboardOffset = if (isKeyboardVisible) {
                getKeyboardOverlapHeight()
            } else {
                0
            }
            val translationY = -keyboardOffset.toFloat()

            messageInputLayout.translationY = translationY
            replyPreviewLayout.translationY = translationY
            attachMenu.translationY = translationY
            emojiShortcut.translationY = translationY
            stickerShortcut.translationY = translationY
            recyclerView.setPadding(
                recyclerView.paddingLeft,
                recyclerView.paddingTop,
                recyclerView.paddingRight,
                originalRecyclerBottomPadding + keyboardOffset
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

        val senderName = if (message.sender?._id == senderId) "You" else textViewReceiverName.text.toString()
        textViewRepliedToName.text = "Replying to $senderName"
        textViewRepliedToMessage.text = message.text ?: "Media message"

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
            if (participant.resolvedOnline) "Online" else "Offline"
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
        textViewReceiverName.text = defaultName ?: "Chat"
        if (::imageViewReceiverPicture.isInitialized) {
            imageViewReceiverPicture.setImageResource(R.drawable.ic_default_profile)
        }
        textViewOnlineStatus.text = "" // Or "Status unavailable"
        imageViewStatusIndicator.visibility = View.GONE
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

    override fun requestEditMessage(messageToEdit: ChatMessage, positionInAdapter: Int) {
        if (messageToEdit.sender?._id != senderId && messageToEdit.senderId != senderId) {
            Toast.makeText(this, "You can only edit your own messages.", Toast.LENGTH_SHORT).show()
            return
        }

        val currentText = messageToEdit.text.orEmpty()
        if (currentText.isBlank()) {
            Toast.makeText(this, "Only text messages can be edited.", Toast.LENGTH_SHORT).show()
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
            .setTitle("Edit message")
            .setView(editText)
            .setPositiveButton("Save", null)
            .setNegativeButton("Cancel", null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val nextText = editText.text.toString().trim()
                when {
                    nextText.isBlank() -> {
                        Toast.makeText(this, "Message cannot be empty.", Toast.LENGTH_SHORT).show()
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
            Toast.makeText(this, "This message cannot be forwarded.", Toast.LENGTH_SHORT).show()
            return
        }

        Toast.makeText(this, "Loading contacts...", Toast.LENGTH_SHORT).show()
        ApiClient.apiService.getContacts().enqueue(object : Callback<List<Contact>> {
            override fun onResponse(call: Call<List<Contact>>, response: Response<List<Contact>>) {
                if (!response.isSuccessful) {
                    Toast.makeText(
                        this@ChatActivity,
                        "Could not load contacts: ${parseError(response)}",
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                val contacts = response.body().orEmpty()
                if (contacts.isEmpty()) {
                    Toast.makeText(this@ChatActivity, "No contacts to forward to.", Toast.LENGTH_SHORT).show()
                    return
                }

                showForwardContactPicker(message, contacts)
            }

            override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                Toast.makeText(this@ChatActivity, "Could not load contacts: ${t.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun showForwardContactPicker(message: ChatMessage, contacts: List<Contact>) {
        val labels = contacts.map { contact ->
            if (contact.location.isBlank()) contact.username else "${contact.username} - ${contact.location}"
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Forward to")
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                forwardMessageToContact(message, contacts[which])
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun forwardMessageToContact(message: ChatMessage, contact: Contact) {
        Toast.makeText(this, "Forwarding to ${contact.username}...", Toast.LENGTH_SHORT).show()
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
                            "Could not open chat: ${response.body()?.message ?: parseError(response)}",
                            Toast.LENGTH_LONG
                        ).show()
                        return
                    }

                    sendForwardedMessage(message, targetRoomId, contact.username)
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(this@ChatActivity, "Could not open chat: ${t.message}", Toast.LENGTH_LONG).show()
                }
            })
    }

    private fun sendForwardedMessage(message: ChatMessage, targetRoomId: String, targetName: String) {
        val payload = buildForwardPayload(message, targetRoomId).toMutableMap()
        if (payload.isEmpty()) {
            Toast.makeText(this, "This message cannot be forwarded.", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.sendMessage(payload).enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful) {
                    Toast.makeText(this@ChatActivity, "Forwarded to $targetName", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        this@ChatActivity,
                        "Forward failed: ${parseError(response)}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Toast.makeText(this@ChatActivity, "Forward failed: ${t.message}", Toast.LENGTH_LONG).show()
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
        chatActivityHelper.onMessageSentByHandler(message)
    }

    override fun onError(error: String) {
        chatActivityHelper.onErrorFromHandler(error)
    }

    override fun onUploadStarted(type: String) {
        val label = when (type) {
            "image" -> "photo"
            "audio" -> "audio"
            "video" -> "video"
            else -> "file"
        }
        Toast.makeText(this, "Uploading $label...", Toast.LENGTH_SHORT).show()
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

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.ifBlank { null }
                ?: "Error ${response.code()} ${response.message()}"
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
        private const val STICKER_PREFS = "chat_stickers"
        private const val KEY_SAVED_STICKERS = "saved_sticker_uris"
        private const val MAX_SAVED_STICKERS = 36
    }
}
