package com.example.yenkasachat.ui

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.util.Log
import android.widget.Toast
import androidx.core.app.ActivityCompat
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.network.ApiClient
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.*

class ChatMessageHandler(
    private val activity: Activity,
    private val callback: ChatMessageCallback,
    private val token: String,
    private val senderId: String,
    private val roomId: String
) {
    private val cloudinaryUploadUrl = "https://api.cloudinary.com/v1_1/dwjj3zsaq/image/upload"
    private val cloudinaryUploadPreset = "yenkasaChatPreset"

    fun sendMessage(payload: Map<String, Any?>) {
        val fullPayload = payload.toMutableMap().apply {
            put("roomId", roomId)
        }

        ApiClient.apiService.sendMessage("Bearer $token", fullPayload)
            .enqueue(object : Callback<ChatMessage> {
                override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                    if (response.isSuccessful && response.body() != null) {
                        callback.onMessageSent(response.body()!!)
                    } else {
                        val errorMsg = response.errorBody()?.string() ?: "Unknown send error"
                        Log.e("ChatMessageHandler", "Send failed: $errorMsg")
                        callback.onError("Failed to send message")
                    }
                }

                override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                    Log.e("ChatMessageHandler", "Send error: ${t.message}", t)
                    callback.onError("Network error: ${t.message}")
                }
            })
    }

    fun uploadFileToCloudinary(uri: Uri, type: String) {
        try {
            val file = createTempFileFromUri(uri, type)

            // Use correct resource type
            val uploadUrl = when (type.lowercase()) {
                "image" -> "https://api.cloudinary.com/v1_1/dwjj3zsaq/image/upload"
                "audio", "video" -> "https://api.cloudinary.com/v1_1/dwjj3zsaq/video/upload"
                "file" -> "https://api.cloudinary.com/v1_1/dwjj3zsaq/raw/upload"
                else -> "https://api.cloudinary.com/v1_1/dwjj3zsaq/raw/upload"
            }

            val mediaType = when (type.lowercase()) {
                "image" -> "image/*"
                "audio" -> "audio/*"
                "video" -> "video/*"
                "file"  -> "*/*"
                else    -> "*/*"
            }

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", file.name, file.asRequestBody(mediaType.toMediaTypeOrNull()))
                .addFormDataPart("upload_preset", cloudinaryUploadPreset)
                .build()

            val request = Request.Builder()
                .url(uploadUrl)
                .post(requestBody)
                .build()

            OkHttpClient().newCall(request).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    Log.e("ChatMessageHandler", "Upload failed: ${e.message}", e)
                    activity.runOnUiThread {
                        callback.onError("$type upload failed: ${e.message}")
                    }
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    val body = response.body?.string()
                    Log.d("CloudinaryUpload", "Response body: $body")

                    val secureUrl = try {
                        JSONObject(body ?: "").optString("secure_url", "")
                    } catch (e: Exception) {
                        Log.e("ChatMessageHandler", "Invalid upload response", e)
                        ""
                    }

                    activity.runOnUiThread {
                        if (secureUrl.isNotBlank()) {
                            val messageKey = when (type.lowercase()) {
                                "image" -> "imageUrl"
                                "audio" -> "audioUrl"
                                "video" -> "videoUrl"
                                "file"  -> "fileUrl"
                                else    -> "fileUrl"
                            }
                            sendMessage(mapOf(messageKey to secureUrl))
                        } else {
                            callback.onError("Upload returned no URL")
                        }
                    }
                }
            })

        } catch (e: Exception) {
            Log.e("ChatMessageHandler", "Upload error: ${e.message}", e)
            callback.onError("Upload error: ${e.message}")
        }
    }


    fun checkAndUploadAudio(uri: Uri) {
        if (ActivityCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.RECORD_AUDIO), 104)
            callback.onError("Microphone permission required")
            return
        }

        // Validate audio file existence
        try {
            val inputStream = activity.contentResolver.openInputStream(uri)
            if (inputStream == null) {
                callback.onError("Audio file not found or unreadable.")
                return
            }
            inputStream.close()
        } catch (e: Exception) {
            callback.onError("Error reading audio file: ${e.message}")
            return
        }

        // Proceed to upload
        uploadFileToCloudinary(uri, "audio")
    }


    fun sendLocation() {
        if (ActivityCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 103)
            callback.onError("Location permission required")
            return
        }

        val fusedLocationClient = com.google.android.gms.location.LocationServices
            .getFusedLocationProviderClient(activity)

        fusedLocationClient.lastLocation
            .addOnSuccessListener { location: Location? ->
                if (location != null) {
                    sendMessage(
                        mapOf(
                            "location" to mapOf(
                                "latitude" to location.latitude,
                                "longitude" to location.longitude
                            )
                        )
                    )
                } else {
                    callback.onError("Location not available")
                }
            }
            .addOnFailureListener {
                callback.onError("Location fetch failed: ${it.message}")
            }
    }

    private fun createTempFileFromUri(uri: Uri, extension: String): File {
        val inputStream: InputStream = activity.contentResolver.openInputStream(uri)
            ?: throw IOException("Failed to open input stream for URI: $uri")

        val tempFile = File.createTempFile("upload_", ".$extension", activity.cacheDir)
        inputStream.use { input ->
            FileOutputStream(tempFile).use { output ->
                input.copyTo(output)
            }
        }
        return tempFile
    }

    interface ChatMessageCallback {
        fun onMessageSent(message: ChatMessage)
        fun onError(error: String)
    }
}
