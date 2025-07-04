package com.example.yenkasachat.ui

import java.io.IOException
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
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream

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
        val fullPayload = payload.toMutableMap()
        fullPayload["roomId"] = roomId
        ApiClient.apiService.sendMessage("Bearer $token", fullPayload).enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful && response.body() != null) {
                    callback.onMessageSent(response.body()!!)
                } else {
                    callback.onError("Send failed")
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                callback.onError("Send error: ${t.message}")
            }
        })
    }

    fun uploadFileToCloudinary(uri: Uri, type: String) {
        try {
            val tempFile = createTempFileFromUri(uri, type)
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("file", tempFile.name, tempFile.asRequestBody("*/*".toMediaTypeOrNull()))
                .addFormDataPart("upload_preset", cloudinaryUploadPreset)
                .build()

            val request = Request.Builder().url(cloudinaryUploadUrl).post(requestBody).build()

            OkHttpClient().newCall(request).enqueue(object : okhttp3.Callback {
                override fun onFailure(call: okhttp3.Call, e: IOException) {
                    activity.runOnUiThread {
                        callback.onError("$type upload failed: ${e.message}")
                    }
                }

                override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                    val body = response.body?.string()
                    val secureUrl = JSONObject(body ?: "").optString("secure_url", "")
                    activity.runOnUiThread {
                        if (secureUrl.isNotBlank()) {
                            val key = when (type) {
                                "image" -> "imageUrl"
                                "audio" -> "audioUrl"
                                "file" -> "fileUrl"
                                else -> "fileUrl"
                            }
                            sendMessage(mapOf(key to secureUrl))
                        } else {
                            callback.onError("Upload failed")
                        }
                    }
                }
            })

        } catch (e: Exception) {
            callback.onError("Upload error: ${e.message}")
        }
    }

    fun checkAndUploadAudio(uri: Uri) {
        if (ActivityCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.RECORD_AUDIO), 104)
            callback.onError("Microphone permission required")
            return
        }
        uploadFileToCloudinary(uri, "audio")
    }

    fun sendLocation() {
        if (ActivityCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 103)
            return
        }

        val fusedLocationClient = com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(activity)
        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
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
        }.addOnFailureListener {
            callback.onError("Location fetch failed: ${it.message}")
        }
    }

    private fun createTempFileFromUri(uri: Uri, extension: String): File {
        val inputStream: InputStream? = activity.contentResolver.openInputStream(uri)
        val tempFile = File.createTempFile("upload_", ".$extension", activity.cacheDir)
        val outStream: OutputStream = FileOutputStream(tempFile)

        inputStream?.use { input ->
            outStream.use { output ->
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
