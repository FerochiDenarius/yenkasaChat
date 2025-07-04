package com.example.yenkasachat.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.location.Location
import android.media.MediaRecorder
import android.net.Uri
import android.os.*
import android.provider.ContactsContract
import android.util.Log
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
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class ChatActivity : AppCompatActivity(), ChatMessageHandler.ChatMessageCallback {

    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var attachMenu: LinearLayout
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var token: String
    private lateinit var senderId: String
    private lateinit var roomId: String
    private lateinit var handler: ChatMessageHandler
    private lateinit var fusedLocationClient: com.google.android.gms.location.FusedLocationProviderClient
    private var lastMessageCount = 0

    private val uiHandler = Handler(Looper.getMainLooper())
    private val refreshInterval = 5000L
    private var isRecording = false
    private var mediaRecorder: MediaRecorder? = null
    private var audioFilePath: String = ""

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        messagesRecyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.buttonSend)
        attachButton = findViewById(R.id.buttonToggleAttachMenu)
        attachMenu = findViewById(R.id.attachmentMenu)

        val attachImageButton: ImageButton = findViewById(R.id.buttonAttachImage)
        val attachAudioButton: ImageButton = findViewById(R.id.buttonAttachAudio)
        val attachLocationButton: ImageButton = findViewById(R.id.buttonAttachLocation)
        val attachFileButton: ImageButton = findViewById(R.id.buttonAttachFile)
        val attachContactButton: ImageButton = findViewById(R.id.buttonAttachContact)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, "Missing token, roomId or userId", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        handler = ChatMessageHandler(this, this, token, senderId, roomId)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        messageAdapter = MessageAdapter(senderId)
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = messageAdapter

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                handler.sendMessage(mapOf("text" to text))
                messageInput.text.clear()
            }
        }

        attachButton.setOnClickListener {
            attachMenu.visibility = if (attachMenu.visibility == LinearLayout.GONE) LinearLayout.VISIBLE else LinearLayout.GONE
        }

        attachImageButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            imagePickerLauncher.launch("image/*")
        }

        attachAudioButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            if (isRecording) {
                stopRecordingAndSend()
            } else {
                startRecording()
            }
        }

        attachFileButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            filePickerLauncher.launch("*/*")
        }

        attachLocationButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE

            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                    if (location != null) {
                        handler.sendMessage(
                            mapOf(
                                "location" to mapOf(
                                    "latitude" to location.latitude,
                                    "longitude" to location.longitude
                                )
                            )
                        )
                    } else {
                        Toast.makeText(this, "Location not available", Toast.LENGTH_SHORT).show()
                    }
                }.addOnFailureListener {
                    Toast.makeText(this, "Failed to get location", Toast.LENGTH_SHORT).show()
                }
            } else {
                requestMissingPermissions()
            }
        }

        attachContactButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
            contactPickerLauncher.launch(intent)
        }

        fetchMessages()
        uiHandler.postDelayed(object : Runnable {
            override fun run() {
                fetchMessages()
                uiHandler.postDelayed(this, refreshInterval)
            }
        }, refreshInterval)

        requestMissingPermissions()
    }

    private fun startRecording() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            requestMissingPermissions()
            Toast.makeText(this, "Microphone permission not granted", Toast.LENGTH_SHORT).show()
            return
        }

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val audioFile = File(getExternalFilesDir(Environment.DIRECTORY_MUSIC), "AUDIO_$timestamp.3gp")
        audioFilePath = audioFile.absolutePath

        mediaRecorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
            setOutputFile(audioFilePath)
            setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
            prepare()
            start()
        }

        isRecording = true
        Toast.makeText(this, "Recording started... Tap again to stop", Toast.LENGTH_SHORT).show()
    }

    private fun stopRecordingAndSend() {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false

            val fileUri = Uri.fromFile(File(audioFilePath))
            handler.checkAndUploadAudio(fileUri)
            Toast.makeText(this, "Recording sent", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to stop recording: ${e.message}", Toast.LENGTH_SHORT).show()
            Log.e("AudioRecording", "Error: ${e.message}")
        }
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId).enqueue(object : Callback<List<ChatMessage>> {
            override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                val messages = response.body()
                if (response.isSuccessful && messages != null) {
                    if (messages.size > lastMessageCount) {
                        val newMessages = messages.subList(lastMessageCount, messages.size)
                        val incomingMessages = newMessages.filter { it.senderId != senderId }

                        if (incomingMessages.isNotEmpty()) {
                            val latest = incomingMessages.last()
                            NotificationHelper.showMessageNotification(
                                this@ChatActivity,
                                latest.senderId ?: "Unknown",
                                latest.text ?: "New message"
                            )
                        }
                    }

                    lastMessageCount = messages.size
                    messageAdapter.submitList(messages.toList())
                    messagesRecyclerView.scrollToPosition(messages.size - 1)
                } else {
                    Log.e("FetchMessages", "Failed: ${response.code()}")
                }
            }

            override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                Log.e("FetchMessages", "Error: ${t.message}")
            }
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        uiHandler.removeCallbacksAndMessages(null)
        mediaRecorder?.release()
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

    private fun requestMissingPermissions() {
        val permissionsNeeded = mutableListOf<String>()

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsNeeded.add(Manifest.permission.RECORD_AUDIO)
        }

        if (permissionsNeeded.isNotEmpty()) {
            permissionsLauncher.launch(permissionsNeeded.toTypedArray())
        }
    }

    override fun onMessageSent(message: ChatMessage) {
        val updated = messageAdapter.currentList.toMutableList()
        updated.add(message)
        messageAdapter.submitList(updated)
        messagesRecyclerView.scrollToPosition(updated.size - 1)
    }

    override fun onError(error: String) {
        Toast.makeText(this, error, Toast.LENGTH_SHORT).show()
    }
}
