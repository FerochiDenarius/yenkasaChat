package xyz.yenkasa.app.ui

import android.content.Context
import android.content.Intent
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
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.ChatRoomAdapter
import xyz.yenkasa.app.model.ChatRoom
// Assuming CreateChatRoomRequest is now used by your ApiService
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
// Removed: import kotlin.io.path.name // This import was likely added due to the incorrect 'name' access
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.IOException

class ChatRoomsActivity : AppCompatActivity() {

    private lateinit var recyclerView: RecyclerView
    private lateinit var chatRoomAdapter: ChatRoomAdapter
    private lateinit var currentUserId: String
    private lateinit var btnCreateRoom: Button
    private lateinit var inputUsername: EditText
    private lateinit var foundCardTitle: TextView
    private lateinit var foundCardSubtitle: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_rooms)
        window.statusBarColor = ContextCompat.getColor(this, R.color.feed_surface)
        window.navigationBarColor = ContextCompat.getColor(this, R.color.yenkasa_emerald)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR

        recyclerView = findViewById(R.id.recyclerViewChatRooms)
        recyclerView.layoutManager = LinearLayoutManager(this)

        btnCreateRoom = findViewById(R.id.btnCreateRoom)
        inputUsername = findViewById(R.id.inputUsername)
        foundCardTitle = findViewById(R.id.textChatRoomsFoundTitle)
        foundCardSubtitle = findViewById(R.id.textChatRoomsFoundSubtitle)
        val foundCard = findViewById<View>(R.id.chatRoomsFoundCard)
        val btnCamera = findViewById<ImageView>(R.id.btnChatRoomsCamera)
        val btnMore = findViewById<ImageView>(R.id.btnChatRoomsMore)
        val btnAddShortcut = findViewById<ImageView>(R.id.btnChatRoomsAddShortcut)
        val navChats = findViewById<TextView>(R.id.navChatRoomsChats)
        val navStatus = findViewById<TextView>(R.id.navChatRoomsStatus)
        val navCalls = findViewById<TextView>(R.id.navChatRoomsCalls)
        val navSettings = findViewById<TextView>(R.id.navChatRoomsSettings)

        val retrievedToken = TokenManager.getToken(this)
        currentUserId = TokenManager.getUserId(this) ?: ""

        if (retrievedToken.isNullOrEmpty() || currentUserId.isEmpty()) {
            Toast.makeText(this, "User not logged in. Please log in again.", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        chatRoomAdapter = ChatRoomAdapter(currentUserId) { selectedRoom ->
            val intent = Intent(this@ChatRoomsActivity, ChatActivity::class.java).apply {
                putExtra("roomId", selectedRoom._id) // This assumes your ChatRoom has an _id field

                val chatName = determineChatDisplayNameForActivity(selectedRoom, currentUserId)
                putExtra("chatPartnerName", chatName)
            }
            startActivity(intent)
        }
        recyclerView.adapter = chatRoomAdapter

        loadChatRooms()

        btnCreateRoom.setOnClickListener {
            submitCreateRoomFromInput()
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
            Toast.makeText(this, "Camera shortcut will be connected in the chat media step", Toast.LENGTH_SHORT).show()
        }

        btnMore.setOnClickListener {
            Toast.makeText(this, "Chat room options will be added after the UI pass", Toast.LENGTH_SHORT).show()
        }

        navChats.setOnClickListener {
            recyclerView.smoothScrollToPosition(0)
            loadChatRooms()
        }

        navStatus.setOnClickListener {
            Toast.makeText(this, "Status will be connected after the chat UI pass", Toast.LENGTH_SHORT).show()
        }

        navCalls.setOnClickListener {
            Toast.makeText(this, "Calls list will be connected after the chat UI pass", Toast.LENGTH_SHORT).show()
        }

        navSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private fun focusUsernameInput() {
        inputUsername.requestFocus()
        val inputMethodManager = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        inputMethodManager.showSoftInput(inputUsername, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun updateFoundCard(rawUsername: String) {
        val username = rawUsername.trim()
        if (username.isBlank()) {
            foundCardTitle.text = "Start a chat"
            foundCardSubtitle.text = "Type a username above, then add the user to your chat list."
        } else {
            foundCardTitle.text = "Ready to add user"
            foundCardSubtitle.text = "Tap Add User to start a chat with $username."
        }
    }

    private fun submitCreateRoomFromInput() {
        val recipientUsername = inputUsername.text.toString().trim()
        if (recipientUsername.isEmpty()) {
            Toast.makeText(this, "Please enter a username to create a chat with", Toast.LENGTH_SHORT).show()
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
            otherParticipants == null -> "Chat" // Participants list was null
            otherParticipants.isEmpty() -> "Chat with Yourself" // Or some other default
            otherParticipants.size == 1 -> otherParticipants.first().username ?: "Chat" // 1-on-1
            else -> {
                // For group chats (more than one other participant)
                // We construct the name from participant usernames as chatRoom.name does not exist.
                otherParticipants.take(2).joinToString(", ") { it.username ?: "User" } +
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
                        Toast.makeText(this@ChatRoomsActivity, "Chat room created!", Toast.LENGTH_SHORT).show()
                        inputUsername.setText("")
                        loadChatRooms() // Refresh the list
                    } else {
                        val errorMsg = parseError(response)
                        val successFlag = responseBody?.success
                        val actualMessage = responseBody?.message ?: errorMsg
                        Log.e("ChatRoomsActivity", "Failed to create room: $actualMessage (Code: ${response.code()}, Success: $successFlag)")
                        Toast.makeText(this@ChatRoomsActivity, "Failed to create room: $actualMessage", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error creating room: ${t.message}", t)
                    Toast.makeText(this@ChatRoomsActivity, "Error creating room: ${t.message}", Toast.LENGTH_SHORT).show()
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
                        }


                        Log.d("ChatRoomsActivity", "Filtered unique chat rooms: ${uniqueRooms.size}")

                        chatRoomAdapter.submitList(uniqueRooms)
                    } else {
                        val errorMsg = parseError(response)
                        Log.e("ChatRoomsActivity", "Failed to load rooms. Code: ${response.code()}, Error: $errorMsg")
                        Toast.makeText(this@ChatRoomsActivity, "Failed to load rooms: $errorMsg", Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatRoom>>, t: Throwable) {
                    Log.e("ChatRoomsActivity", "Error loading chat rooms: ${t.message}", t)
                    Toast.makeText(this@ChatRoomsActivity, "Error loading chat rooms: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun parseError(response: Response<*>): String {
        return try {
            response.errorBody()?.string()?.let { errorJson ->
                if (errorJson.contains("\"message\"")) {
                    try {
                        errorJson.split("\"message\":\"")[1].split("\"")[0]
                    } catch (e: Exception) { errorJson }
                } else { errorJson }
            } ?: "Error: ${response.code()} ${response.message()} (No specific error body)"
        } catch (e: IOException) {
            "Error reading error response: ${e.message}"
        }
    }
}
