package com.example.yenkasachat.ui

import okhttp3.Callback as OkHttpCallback
import android.Manifest
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.location.Location
import android.location.LocationManager
import android.net.Uri
import android.os.*
import android.provider.ContactsContract
import android.provider.MediaStore
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
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException

class ChatActivity : AppCompatActivity() {

    private lateinit var messagesRecyclerView: RecyclerView
    private lateinit var messageInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var attachMenu: LinearLayout
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var token: String
    private lateinit var senderId: String
    private lateinit var roomId: String
    private lateinit var fusedLocationClient: FusedLocationProviderClient


    private val handler = Handler(Looper.getMainLooper())
    private val refreshInterval = 5000L

    private val cloudinaryUploadUrl = "https://api.cloudinary.com/v1_1/dwjj3zsaq/image/upload"
    private val cloudinaryUploadPreset = "yenkasaChatPreset"

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { uploadFileToCloudinary(it, "image") }
    }

    private val audioPickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { uploadFileToCloudinary(it, "audio") }
    }

    private val filePickerLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) {
        it?.let { uploadFileToCloudinary(it, "file") }
    }

    private val contactPickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val uri = it.data?.data ?: return@registerForActivityResult
        val cursor: Cursor? = contentResolver.query(uri, null, null, null, null)
        cursor?.use { cur ->
            val nameIndex = cur.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME)
            val name = if (nameIndex != -1 && cur.moveToFirst()) cur.getString(nameIndex) else "Unknown"
            sendMessage(mapOf("contactInfo" to name))
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
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)


        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (token.isBlank() || roomId.isBlank() || senderId.isBlank()) {
            Toast.makeText(this, "Missing token, roomId or userId", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        messageAdapter = MessageAdapter(senderId)
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = messageAdapter

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                sendMessage(mapOf("text" to text))
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
            audioPickerLauncher.launch("audio/*")
        }

        attachFileButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            filePickerLauncher.launch("*/*")
        }

        attachLocationButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 103)
                return@setOnClickListener
            }

            fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                if (location != null) {
                    sendMessage(mapOf("location" to mapOf("latitude" to location.latitude, "longitude" to location.longitude)))
                } else {
                    Toast.makeText(this, "Location not available", Toast.LENGTH_SHORT).show()
                }
            }.addOnFailureListener {
                Toast.makeText(this, "Location fetch failed: ${it.message}", Toast.LENGTH_SHORT).show()
            }
        }


        attachContactButton.setOnClickListener {
            attachMenu.visibility = LinearLayout.GONE
            val intent = Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI)
            contactPickerLauncher.launch(intent)
        }

        fetchMessages()
        handler.postDelayed(object : Runnable {
            override fun run() {
                fetchMessages()
                handler.postDelayed(this, refreshInterval)
            }
        }, refreshInterval)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId).enqueue(object : Callback<List<ChatMessage>> {
            override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                val messages = response.body()
                if (response.isSuccessful && messages != null) {
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

    private fun sendMessage(payload: Map<String, Any?>) {
        val fullPayload = payload.toMutableMap()
        fullPayload["roomId"] = roomId
        ApiClient.apiService.sendMessage("Bearer $token", fullPayload.toMap())
            .enqueue(object : Callback<ChatMessage> {
                override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                    if (response.isSuccessful && response.body() != null) {
                        val updated = messageAdapter.currentList.toMutableList()
                        updated.add(response.body()!!)
                        messageAdapter.submitList(updated)
                        messagesRecyclerView.scrollToPosition(updated.size - 1)
                    } else {
                        Toast.makeText(this@ChatActivity, "Send failed", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                    Toast.makeText(this@ChatActivity, "Send error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun uploadFileToCloudinary(uri: Uri, type: String) {
        try {
            val inputStream = contentResolver.openInputStream(uri)
            val tempFile = File.createTempFile("upload_", ".$type", cacheDir)
            inputStream?.copyTo(tempFile.outputStream())

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", tempFile.name, tempFile.asRequestBody("*/*".toMediaTypeOrNull()))
                .addFormDataPart("upload_preset", cloudinaryUploadPreset)
                .build()

            val request = Request.Builder().url(cloudinaryUploadUrl).post(requestBody).build()

            OkHttpClient().newCall(request).enqueue(object : OkHttpCallback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    runOnUiThread {
                        Toast.makeText(this@ChatActivity, "$type upload failed: ${e.message}", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    val body = response.body?.string()
                    val secureUrl = JSONObject(body ?: "").optString("secure_url", "")
                    runOnUiThread {
                        if (secureUrl.isNotBlank()) {
                            val key = when (type) {
                                "image" -> "imageUrl"
                                "audio" -> "audioUrl"
                                "file" -> "fileUrl"
                                else -> "fileUrl"
                            }
                            sendMessage(mapOf(key to secureUrl))
                        } else {
                            Toast.makeText(this@ChatActivity, "Upload failed", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            })

        } catch (e: Exception) {
            Toast.makeText(this, "Upload error: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, results)
        if (requestCode == 101 && results.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            imagePickerLauncher.launch("image/*")
        } else if (requestCode == 103) {
            Toast.makeText(this, "Location permission granted. Tap again.", Toast.LENGTH_SHORT).show()
        }
    }
}
