package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.*
import android.provider.MediaStore
import android.util.Log
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
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
    private lateinit var messageAdapter: MessageAdapter
    private lateinit var roomId: String
    private lateinit var senderId: String
    private lateinit var token: String
    private val handler = Handler(Looper.getMainLooper())
    private val refreshInterval = 5000L

    private val cloudinaryUploadUrl = "https://api.cloudinary.com/v1_1/dwjj3zsaq/image/upload"
    private val cloudinaryUploadPreset = "yenkasaChatPreset"

    private val messagePollingRunnable = object : Runnable {
        override fun run() {
            fetchMessages()
            handler.postDelayed(this, refreshInterval)
        }
    }

    private val imagePickerLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        if (it.resultCode == Activity.RESULT_OK) {
            val imageUri = it.data?.data
            if (imageUri != null) {
                Toast.makeText(this, "Image selected!", Toast.LENGTH_SHORT).show()
                uploadImageToCloudinary(imageUri)
            } else {
                Toast.makeText(this, "No image selected", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "Image picker canceled", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat)

        val prefs = getSharedPreferences("auth", Context.MODE_PRIVATE)
        token = prefs.getString("token", "") ?: ""
        senderId = prefs.getString("userId", "") ?: ""
        roomId = intent.getStringExtra("roomId") ?: ""

        if (roomId.isEmpty() || senderId.isEmpty() || token.isEmpty()) {
            Toast.makeText(this, "Missing chat data or not logged in", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        messagesRecyclerView = findViewById(R.id.recyclerViewMessages)
        messageInput = findViewById(R.id.editTextMessage)
        sendButton = findViewById(R.id.buttonSend)
        attachButton = findViewById(R.id.buttonAttach)

        messageAdapter = MessageAdapter(senderId)
        messagesRecyclerView.layoutManager = LinearLayoutManager(this)
        messagesRecyclerView.adapter = messageAdapter

        sendButton.setOnClickListener {
            val text = messageInput.text.toString().trim()
            if (text.isNotEmpty()) {
                sendTextMessage(text)
            }
        }

        attachButton.setOnClickListener {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                requestPermissions(arrayOf(android.Manifest.permission.READ_MEDIA_IMAGES), 101)
            } else {
                requestPermissions(arrayOf(android.Manifest.permission.READ_EXTERNAL_STORAGE), 101)
            }
        }

        fetchMessages()
        handler.postDelayed(messagePollingRunnable, refreshInterval)
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(messagePollingRunnable)
    }

    private fun fetchMessages() {
        ApiClient.apiService.getMessages("Bearer $token", roomId)
            .enqueue(object : Callback<List<ChatMessage>> {
                override fun onResponse(call: Call<List<ChatMessage>>, response: Response<List<ChatMessage>>) {
                    if (response.isSuccessful && response.body() != null) {
                        val newMessages = response.body() ?: emptyList()
                        val layoutManager = messagesRecyclerView.layoutManager as LinearLayoutManager
                        val lastVisible = layoutManager.findLastCompletelyVisibleItemPosition()
                        val isAtBottom = lastVisible == messageAdapter.itemCount - 1

                        messageAdapter.submitList(newMessages)

                        if (isAtBottom || messageAdapter.itemCount == 0) {
                            messagesRecyclerView.scrollToPosition(newMessages.size - 1)
                        }
                    } else {
                        Toast.makeText(this@ChatActivity, "Failed to load messages", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<List<ChatMessage>>, t: Throwable) {
                    Toast.makeText(this@ChatActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun sendTextMessage(text: String) {
        val request = mapOf(
            "roomId" to roomId,
            "senderId" to senderId,
            "text" to text
        )

        Log.d("SEND_MESSAGE_BODY", request.toString())

        ApiClient.apiService.sendMessage("Bearer $token", request)
            .enqueue(object : Callback<ChatMessage> {
                override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                    if (response.isSuccessful && response.body() != null) {
                        val newMessage = response.body()!!
                        val updatedMessages = messageAdapter.currentList.toMutableList()
                        updatedMessages.add(newMessage)
                        messageAdapter.submitList(updatedMessages.toList())
                        messagesRecyclerView.scrollToPosition(updatedMessages.size - 1)
                        messageInput.text.clear()
                    } else {
                        val error = response.errorBody()?.string()
                        Log.e("SEND_TEXT_FAIL", "Code: ${response.code()} Error: $error")
                        Toast.makeText(this@ChatActivity, "❌ Failed to send message", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                    Log.e("SEND_TEXT_FAIL", "Exception: ${Log.getStackTraceString(t)}")
                    Toast.makeText(this@ChatActivity, "❌ Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun sendImageMessage(imageUrl: String) {
        val request = mapOf(
            "roomId" to roomId,
            "senderId" to senderId,
            "imageUrl" to imageUrl
        )

        Log.d("SEND_IMAGE_BODY", request.toString())

        ApiClient.apiService.sendMessage("Bearer $token", request)
            .enqueue(object : Callback<ChatMessage> {
                override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                    if (response.isSuccessful && response.body() != null) {
                        val newMessage = response.body()!!
                        val updatedMessages = messageAdapter.currentList.toMutableList()
                        updatedMessages.add(newMessage)
                        messageAdapter.submitList(updatedMessages.toList())
                        messagesRecyclerView.scrollToPosition(updatedMessages.size - 1)
                    } else {
                        val error = response.errorBody()?.string()
                        Log.e("SEND_IMAGE_FAIL", "Code: ${response.code()} Error: $error")
                        Toast.makeText(this@ChatActivity, "❌ Failed to send image", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                    Log.e("SEND_IMAGE_FAIL", "Exception: ${Log.getStackTraceString(t)}")
                    Toast.makeText(this@ChatActivity, "❌ Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun uploadImageToCloudinary(imageUri: Uri) {
        try {
            val inputStream = contentResolver.openInputStream(imageUri)
            if (inputStream == null) {
                Toast.makeText(this, "Unable to open image", Toast.LENGTH_SHORT).show()
                return
            }

            val tempFile = File.createTempFile("upload_", ".jpg", cacheDir)
            tempFile.outputStream().use { output ->
                inputStream.copyTo(output)
            }

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file", tempFile.name,
                    tempFile.asRequestBody("image/*".toMediaTypeOrNull())
                )
                .addFormDataPart("upload_preset", cloudinaryUploadPreset)
                .build()

            val request = Request.Builder()
                .url(cloudinaryUploadUrl)
                .post(requestBody)
                .build()

            OkHttpClient().newCall(request).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    runOnUiThread {
                        Toast.makeText(this@ChatActivity, "Upload failed: ${e.message}", Toast.LENGTH_SHORT).show()
                        Log.e("Cloudinary", "Upload error: ${e.message}")
                    }
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    try {
                        val responseString = response.body?.string()
                        Log.d("Cloudinary", "Upload response: $responseString")

                        val json = JSONObject(responseString ?: "")
                        val imageUrl = json.optString("secure_url") // ✅ FIXED HERE

                        if (imageUrl.isNotBlank()) {
                            runOnUiThread {
                                sendImageMessage(imageUrl)
                            }
                        } else {
                            runOnUiThread {
                                Toast.makeText(this@ChatActivity, "Image URL not found in response", Toast.LENGTH_SHORT).show()
                            }
                        }
                    } catch (e: Exception) {
                        runOnUiThread {
                            Toast.makeText(this@ChatActivity, "Error parsing Cloudinary response", Toast.LENGTH_SHORT).show()
                            Log.e("Cloudinary", "Parse error: ${e.message}")
                        }
                    }
                }
            })
        } catch (e: Exception) {
            Toast.makeText(this, "Unexpected error: ${e.message}", Toast.LENGTH_SHORT).show()
            Log.e("Cloudinary", "Exception", e)
        }
    }


    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            imagePickerLauncher.launch(intent)
        } else {
            Toast.makeText(this, "Permission denied to read images", Toast.LENGTH_SHORT).show()
        }
    }
}
