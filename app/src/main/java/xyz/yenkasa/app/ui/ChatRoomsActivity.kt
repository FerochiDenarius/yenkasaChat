package xyz.yenkasa.app.ui

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ChatRoomAdapter
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.ChatRoom
// Assuming CreateChatRoomRequest is now used by your ApiService
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.model.GroupsListResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.EdgeToEdgeInsets
import xyz.yenkasa.app.util.TokenManager
// Removed: import kotlin.io.path.name // This import was likely added due to the incorrect 'name' access
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class ChatRoomsActivity : AppCompatActivity(), ChatMessageHandler.ChatMessageCallback {

    private lateinit var recyclerView: RecyclerView
    private lateinit var chatRoomAdapter: ChatRoomAdapter
    private lateinit var currentUserId: String
    private var token: String = ""
    private lateinit var btnCreateRoom: Button
    private lateinit var inputUsername: EditText
    private lateinit var foundCardTitle: TextView
    private lateinit var foundCardSubtitle: TextView
    private lateinit var groupUnreadBadge: TextView
    private var recentChatRooms: List<ChatRoom> = emptyList()
    private var activeMediaSender: ChatMessageHandler? = null
    private var pendingMediaRecipientName: String? = null
    private var activeTab: String = "chats"

    private val chatRoomImagePickerLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
            uri?.let { showChatRecipientPicker(it) }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_rooms)
        EdgeToEdgeInsets.setLightSystemBars(
            window = window,
            lightStatusBars = true,
            lightNavigationBars = false
        )

        recyclerView = findViewById(R.id.recyclerViewChatRooms)
        recyclerView.layoutManager = LinearLayoutManager(this)

        btnCreateRoom = findViewById(R.id.btnCreateRoom)
        inputUsername = findViewById(R.id.inputUsername)
        foundCardTitle = findViewById(R.id.textChatRoomsFoundTitle)
        foundCardSubtitle = findViewById(R.id.textChatRoomsFoundSubtitle)
        groupUnreadBadge = findViewById(R.id.textGroupUnreadBadge)
        val foundCard = findViewById<View>(R.id.chatRoomsFoundCard)
        val btnCamera = findViewById<ImageView>(R.id.btnChatRoomsCamera)
        val btnMore = findViewById<ImageView>(R.id.btnChatRoomsMore)
        val btnAddShortcut = findViewById<ImageView>(R.id.btnChatRoomsAddShortcut)
        val navChats = findViewById<TextView>(R.id.navChatRoomsChats)
        val navStatus = findViewById<TextView>(R.id.navChatRoomsStatus)
        val navCalls = findViewById<TextView>(R.id.navChatRoomsCalls)
        val navSettings = findViewById<TextView>(R.id.navChatRoomsSettings)

        val retrievedToken = TokenManager.getToken(this)
        token = retrievedToken.orEmpty()
        currentUserId = TokenManager.getUserId(this) ?: ""

        if (retrievedToken.isNullOrEmpty() || currentUserId.isEmpty()) {
            Toast.makeText(this, R.string.session_expired_login_again, Toast.LENGTH_LONG).show()
            finish()
            return
        }

        chatRoomAdapter = ChatRoomAdapter(
            currentUserId = currentUserId,
            onChatRoomClick = { selectedRoom -> openChatRoom(selectedRoom) },
            onChatRoomLongClick = { selectedRoom ->
                if (selectedRoom.roomType == "group") showGroupLongPressOptions(selectedRoom)
            }
        )
        recyclerView.adapter = chatRoomAdapter

        loadChatRooms()

        btnCreateRoom.setOnClickListener {
            if (activeTab == "groups") {
                startActivity(Intent(this, GroupContactsSelectorActivity::class.java))
            } else {
                submitCreateRoomFromInput()
            }
        }

        inputUsername.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submitCreateRoomFromInput()
                true
            } else {
                false
            }
        }
        inputUsername.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                updateFoundCard(s?.toString().orEmpty())
            }

            override fun afterTextChanged(s: Editable?) = Unit
        })
        updateFoundCard(inputUsername.text?.toString().orEmpty())

        btnAddShortcut.setOnClickListener {
            focusUsernameInput()
        }

        foundCard.setOnClickListener {
            focusUsernameInput()
        }

        btnCamera.setOnClickListener {
            openImagePickerForChatRoom()
        }

        btnMore.setOnClickListener {
            Toast.makeText(this, R.string.chat_room_options_coming, Toast.LENGTH_SHORT).show()
        }

        navChats.setOnClickListener {
            activeTab = "chats"
            inputUsername.hint = getString(R.string.chat_type_name_start)
            btnCreateRoom.text = getString(R.string.add_user)
            updateFoundCard(inputUsername.text?.toString().orEmpty())
            loadChatRooms()
        }

        navStatus.setOnClickListener {
            activeTab = "groups"
            inputUsername.hint = getString(R.string.search_groups)
            btnCreateRoom.text = getString(R.string.create)
            updateFoundCard(inputUsername.text?.toString().orEmpty())
            loadGroups()
        }

        navCalls.setOnClickListener {
            activeTab = "announcements"
            chatRoomAdapter.submitList(emptyList())
            foundCardTitle.text = getString(R.string.announcements)
            foundCardSubtitle.text = getString(R.string.announcement_channels_empty)
        }

        navSettings.setOnClickListener {
            activeTab = "status"
            chatRoomAdapter.submitList(emptyList())
            foundCardTitle.text = getString(R.string.status)
            foundCardSubtitle.text = getString(R.string.status_updates_empty)
        }
    }

    private fun openChatRoom(selectedRoom: ChatRoom) {
        val target = if (selectedRoom.roomType == "group") GroupChatActivity::class.java else ChatActivity::class.java
        val intent = Intent(this@ChatRoomsActivity, target).apply {
            putExtra("roomId", selectedRoom._id)

            val chatName = if (selectedRoom.roomType == "group") {
                selectedRoom.groupName ?: getString(R.string.group_default_name)
            } else {
                determineChatDisplayNameForActivity(selectedRoom, currentUserId)
            }
            putExtra("chatPartnerName", chatName)
            putExtra("groupImage", selectedRoom.groupImage.orEmpty())
            putExtra("groupMemberCount", selectedRoom.memberCount)
            putExtra("isGroupChat", selectedRoom.roomType == "group")
        }
        startActivity(intent)
    }

    private fun showGroupLongPressOptions(group: ChatRoom) {
        val canManage = canManageGroup(group)
        val actions = if (canManage) {
            listOf(
                R.string.open_group,
                R.string.group_add_members,
                R.string.delete_group
            )
        } else {
            listOf(
                R.string.open_group,
                R.string.leave_group
            )
        }
        val labels = actions.map { getString(it) }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(group.groupName ?: getString(R.string.group_default_name))
            .setItems(labels) { _, which ->
                when (actions[which]) {
                    R.string.open_group -> openChatRoom(group)
                    R.string.group_add_members -> openGroupAddMembers(group)
                    R.string.delete_group -> confirmDeleteGroup(group)
                    R.string.leave_group -> confirmLeaveGroup(group)
                }
            }
            .show()
    }

    private fun openGroupAddMembers(group: ChatRoom) {
        startActivity(Intent(this, GroupContactsSelectorActivity::class.java).apply {
            putExtra("mode", "addMembers")
            putExtra("groupId", group._id)
            putStringArrayListExtra(
                "existingMemberIds",
                ArrayList(group.participants.orEmpty().map { it._id })
            )
        })
    }

    private fun confirmLeaveGroup(group: ChatRoom) {
        AlertDialog.Builder(this)
            .setTitle(R.string.leave_group_title)
            .setMessage(getString(R.string.leave_group_message, group.groupName ?: getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.leave) { _, _ ->
                ApiClient.apiService.leaveGroup(group._id).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@ChatRoomsActivity, response.body()?.message ?: getString(R.string.could_not_leave_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@ChatRoomsActivity, R.string.you_left_group, Toast.LENGTH_SHORT).show()
                        loadGroups()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            getString(R.string.could_not_leave_group_with_error, t.message ?: getString(R.string.unknown_error)),
                            Toast.LENGTH_LONG
                        ).show()
                    }
                })
            }
            .show()
    }

    private fun confirmDeleteGroup(group: ChatRoom) {
        AlertDialog.Builder(this)
            .setTitle(R.string.delete_group_title)
            .setMessage(getString(R.string.delete_group_message, group.groupName ?: getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.delete) { _, _ ->
                ApiClient.apiService.deleteGroup(group._id).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(this@ChatRoomsActivity, response.body()?.message ?: getString(R.string.could_not_delete_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(this@ChatRoomsActivity, R.string.group_deleted, Toast.LENGTH_SHORT).show()
                        loadGroups()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        Toast.makeText(
                            this@ChatRoomsActivity,
                            getString(R.string.could_not_delete_group_with_error, t.message ?: getString(R.string.unknown_error)),
                            Toast.LENGTH_LONG
                        ).show()
                    }
                })
            }
            .show()
    }

    private fun canManageGroup(group: ChatRoom): Boolean {
        return currentUserId.isNotBlank() &&
            (group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId))
    }

    override fun onResume() {
        super.onResume()
        if (::chatRoomAdapter.isInitialized && ::currentUserId.isInitialized && currentUserId.isNotBlank()) {
            if (activeTab == "groups") loadGroups() else if (activeTab == "chats") loadChatRooms()
        }
    }

    private fun focusUsernameInput() {
        inputUsername.requestFocus()
        val inputMethodManager = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        inputMethodManager.showSoftInput(inputUsername, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun openImagePickerForChatRoom() {
        if (recentChatRooms.isEmpty()) {
            Toast.makeText(this, R.string.start_chat_first_send_images, Toast.LENGTH_SHORT).show()
            focusUsernameInput()
            return
        }

        chatRoomImagePickerLauncher.launch("image/*")
    }

    private fun showChatRecipientPicker(imageUri: Uri) {
        val rooms = recentChatRooms
        if (rooms.isEmpty()) {
            Toast.makeText(this, R.string.no_chat_users_available, Toast.LENGTH_SHORT).show()
            return
        }

        val labels = rooms.map { room ->
            determineChatDisplayNameForActivity(room, currentUserId)
        }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle(R.string.send_image_to)
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                sendImageToChatRoom(imageUri, rooms[which], labels[which])
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun sendImageToChatRoom(imageUri: Uri, chatRoom: ChatRoom, recipientName: String) {
        pendingMediaRecipientName = recipientName
        activeMediaSender = ChatMessageHandler(
            context = this,
            callback = this,
            token = token,
            senderId = currentUserId,
            roomId = chatRoom._id
        )
        activeMediaSender?.uploadFileToCloudinary(imageUri, "image")
    }

    private fun updateFoundCard(rawUsername: String) {
        val username = rawUsername.trim()
        if (username.isBlank()) {
            if (activeTab == "groups") {
                foundCardTitle.text = getString(R.string.groups)
                foundCardSubtitle.text = getString(R.string.create_group_existing_contacts)
            } else {
                foundCardTitle.text = getString(R.string.start_chat)
                foundCardSubtitle.text = getString(R.string.start_chat_instruction)
            }
        } else {
            if (activeTab == "groups") {
                foundCardTitle.text = getString(R.string.search_groups)
                foundCardSubtitle.text = getString(R.string.group_search_existing_only)
            } else {
                foundCardTitle.text = getString(R.string.ready_to_add_user)
                foundCardSubtitle.text = getString(R.string.tap_add_user_to_start_chat, username)
            }
        }
    }

    private fun submitCreateRoomFromInput() {
        val recipientUsername = inputUsername.text.toString().trim()
        if (recipientUsername.isEmpty()) {
            Toast.makeText(this, R.string.enter_username_create_chat, Toast.LENGTH_SHORT).show()
        } else {
            createChatRoom(recipientUsername)
        }
    }

    /**
     * Determines a display name for the chat to be passed to ChatActivity.
     * This logic relies on the properties available in your existing ChatRoom model.
     */
    private fun determineChatDisplayNameForActivity(chatRoom: ChatRoom, currentUserId: String): String {
        // Assuming chatRoom.participants is List<Participant>?
        // and Participant has _id: String and username: String?
        val otherParticipants = chatRoom.participants?.filter { it._id != currentUserId }

        return when {
            otherParticipants == null -> getString(R.string.chat) // Participants list was null
            otherParticipants.isEmpty() -> getString(R.string.chat_with_yourself) // Or some other default
            otherParticipants.size == 1 -> otherParticipants.first().username ?: getString(R.string.chat) // 1-on-1
            else -> {
                // For group chats (more than one other participant)
                // We construct the name from participant usernames as chatRoom.name does not exist.
                otherParticipants.take(2).joinToString(", ") { it.username ?: getString(R.string.user) } +
                        if (otherParticipants.size > 2) "..." else ""
            }
        }
    }


    private fun createChatRoom(username: String) {
        Log.d("ChatRoomsActivity", "Attempting to create chat room with username: $username")

        // Assuming your ApiService.createChatRoom now expects CreateChatRoomRequest
        // If it still expects a Map: val requestBody = mapOf("username" to username)
        val request = CreateChatRoomRequest(username = username)

        ApiClient.apiService.createChatRoom(request)
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val responseBody = response.body()
                    if (response.isSuccessful && responseBody != null && responseBody.success) {
                        Log.d("ChatRoomsActivity", "Room created successfully! Room ID: ${responseBody.roomId}")
                        Toast.makeText(this@ChatRoomsActivity, R.string.chat_room_created, Toast.LENGTH_SHORT).show()
                        inputUsername.setText("")
                        loadChatRooms() // Refresh the list
                    } else if (response.code() == 202 && responseBody?.message != null) {
                        Toast.makeText(this@ChatRoomsActivity, responseBody.message, Toast.LENGTH_LONG).show()
                        inputUsername.setText("")
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = responseBody?.success
                        val actualMessage = responseBody?.message ?: errorMsg
                        Log.e("ChatRoomsActivity", "Failed to create room: $actualMessage (Code: ${response.code()}, Success: $successFlag)")
                        Toast.makeText(this@ChatRoomsActivity, getString(R.string.chat_failed_create_room, actualMessage), Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error creating room: ${t.message}", t)
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        getString(R.string.chat_error_creating_room, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun loadChatRooms() {
        Log.d("ChatRoomsActivity", "Attempting to load chat rooms...")
        ApiClient.apiService.getChatRooms()
            .enqueue(object : Callback<List<ChatRoom>> {
                override fun onResponse(
                    call: Call<List<ChatRoom>>,
                    response: Response<List<ChatRoom>>
                ) {
                    Log.d("ChatRoomsActivity", "Chat rooms response received: Code ${response.code()}")
                    if (response.isSuccessful && response.body() != null) {
                        val rooms = response.body()!!
                        Log.d("ChatRoomsActivity", "Chat rooms loaded: ${rooms.size}")

                        val uniqueRooms = rooms.distinctBy { room ->
                            // Identify each chat uniquely by the *other participant’s* ID
                            room.participants
                                ?.firstOrNull { it._id != currentUserId }
                                ?._id ?: room._id
                        }.sortedWith(
                            compareByDescending<ChatRoom> { it.lastActivityTimeMillis }
                                .thenByDescending { it.unreadCount }
                        )


                        Log.d("ChatRoomsActivity", "Filtered unique chat rooms: ${uniqueRooms.size}")

                        recentChatRooms = uniqueRooms
                        chatRoomAdapter.submitList(uniqueRooms)
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ChatRoomsActivity", "Failed to load rooms. Code: ${response.code()}, Error: $errorMsg")
                        Toast.makeText(this@ChatRoomsActivity, getString(R.string.failed_to_load_rooms_with_error, errorMsg), Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error loading chat rooms: ${t.message}", t)
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        getString(R.string.error_loading_chat_rooms_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun loadGroups() {
        ApiClient.apiService.getGroups()
            .enqueue(object : Callback<GroupsListResponse> {
                override fun onResponse(
                    call: Call<GroupsListResponse>,
                    response: Response<GroupsListResponse>
                ) {
                    if (response.isSuccessful) {
                        val groups = response.body()?.groups.orEmpty()
                            .sortedWith(compareByDescending<ChatRoom> { it.lastActivityTimeMillis }
                                .thenByDescending { it.unreadCount })
                        Log.d("ChatRoomsActivity", "Loaded ${groups.size} groups")
                        updateGroupUnreadBadge(groups)
                        chatRoomAdapter.submitList(groups)
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ChatRoomsActivity", "Failed to load groups. Code: ${response.code()}, Error: $errorMsg")
                        Toast.makeText(this@ChatRoomsActivity, getString(R.string.failed_to_load_groups_with_error, errorMsg), Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<GroupsListResponse>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error loading groups: ${t.message}", t)
                    Toast.makeText(
                        this@ChatRoomsActivity,
                        getString(R.string.error_loading_groups_with_message, t.message ?: getString(R.string.unknown_error)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun updateGroupUnreadBadge(groups: List<ChatRoom>) {
        if (!::groupUnreadBadge.isInitialized) return
        val unreadTotal = groups.sumOf { it.unreadCount }
        if (unreadTotal > 0) {
            groupUnreadBadge.visibility = View.VISIBLE
            groupUnreadBadge.text = if (unreadTotal > 99) "99+" else unreadTotal.toString()
        } else {
            groupUnreadBadge.visibility = View.GONE
        }
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.let { errorJson ->
                if (errorJson.contains("\"message\"")) {
                    try {
                        errorJson.split("\"message\":\"")[1].split("\"")[0]
                    } catch (e: Exception) { errorJson }
                } else { errorJson }
            } ?: getString(R.string.chat_error_code_no_body, response.code(), response.message())
        } catch (e: IOException) {
            getString(R.string.chat_error_reading_response, e.message ?: getString(R.string.unknown_error))
        }
    }

    override fun onUploadStarted(type: String) {
        Toast.makeText(this, R.string.sending_image, Toast.LENGTH_SHORT).show()
    }

    override fun onMessageSent(message: ChatMessage) {
        val recipientName = pendingMediaRecipientName ?: getString(R.string.chat)
        Toast.makeText(this, getString(R.string.image_sent_to, recipientName), Toast.LENGTH_SHORT).show()
        pendingMediaRecipientName = null
        activeMediaSender = null
        loadChatRooms()
    }

    override fun onError(error: String) {
        Toast.makeText(this, error, Toast.LENGTH_LONG).show()
        pendingMediaRecipientName = null
        activeMediaSender = null
    }
}
