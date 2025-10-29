package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View // ✅ Import View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.ui.PostApprovalActivity
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL


class PostActivity : AppCompatActivity() {

    private lateinit var editTextContent: EditText
    private lateinit var imagePreview: ImageView
    private lateinit var videoPreview: VideoView
    private lateinit var audioPreview: TextView
    private lateinit var btnChooseMedia: Button
    private lateinit var btnPost: Button
    private lateinit var progressBar: ProgressBar // ✅ Add ProgressBar
    private var mediaUri: Uri? = null
    private var mediaType: String? = null

    companion object {
        private const val PICK_MEDIA_REQUEST = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post)

        // Toolbar setup
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Create Post"
        toolbar.setNavigationOnClickListener { finish() }

        editTextContent = findViewById(R.id.editTextContent)
        imagePreview = findViewById(R.id.imagePreview)
        videoPreview = findViewById(R.id.videoPreview)
        audioPreview = findViewById(R.id.audioPreview)
        btnChooseMedia = findViewById(R.id.btnChooseMedia)
        btnPost = findViewById(R.id.btnPost)
        progressBar = findViewById(R.id.progressBar) // ✅ Initialize ProgressBar

        btnChooseMedia.setOnClickListener {
            // Prevent choosing new media while an upload is in progress
            if (!btnPost.isEnabled) {
                Toast.makeText(
                    this,
                    "Please wait for the current upload to finish.",
                    Toast.LENGTH_SHORT
                ).show()
                return@setOnClickListener
            }
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "audio/*"))
            startActivityForResult(Intent.createChooser(intent, "Select Media"), PICK_MEDIA_REQUEST)
        }

        btnPost.setOnClickListener {
            val content = editTextContent.text.toString().trim()
            if (content.isEmpty() && mediaUri == null) {
                Toast.makeText(this, "Add text or media before posting.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            uploadPost(content)
        }
    }

    // ... onActivityResult and updatePreview methods remain the same ...
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == PICK_MEDIA_REQUEST && resultCode == Activity.RESULT_OK && data?.data != null) {
            mediaUri = data.data
            val mimeType = contentResolver.getType(mediaUri!!)
            mediaType = when {
                mimeType?.startsWith("image") == true -> "image"
                mimeType?.startsWith("video") == true -> "video"
                mimeType?.startsWith("audio") == true -> "audio"
                else -> null
            }

            updatePreview()
        }
    }

    private fun updatePreview() {
        imagePreview.visibility = ImageView.GONE
        videoPreview.visibility = VideoView.GONE
        audioPreview.visibility = TextView.GONE

        when (mediaType) {
            "image" -> {
                imagePreview.visibility = ImageView.VISIBLE
                imagePreview.setImageURI(mediaUri)
            }

            "video" -> {
                videoPreview.visibility = VideoView.VISIBLE
                videoPreview.setVideoURI(mediaUri)
                videoPreview.start()
            }

            "audio" -> {
                audioPreview.visibility = TextView.VISIBLE
                audioPreview.text = "Audio selected: ${mediaUri?.lastPathSegment}"
            }
        }
    }


// In PostActivity.kt

    private fun uploadPost(content: String) {
        val token = TokenManager.getToken(this)
        if (token == null) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            return
        }

        btnPost.isEnabled = false
        progressBar.visibility = View.VISIBLE

        val captionBody = RequestBody.create("text/plain".toMediaTypeOrNull(), content)
        val mediaTypeString = mediaType ?: "text"
        val mediaTypeBody = RequestBody.create("text/plain".toMediaTypeOrNull(), mediaTypeString)
        var mediaPart: MultipartBody.Part? = null

        mediaUri?.let { uri ->
            try {
                // ✅ USE THE NEW, SAFER METHOD TO GET A FILE
                val file = getFileFromUri(uri)
                if (file == null) {
                    throw IOException("Failed to create temp file from Uri")
                }

                val mime = contentResolver.getType(uri) ?: "application/octet-stream"
                val requestFile = RequestBody.create(mime.toMediaTypeOrNull(), file)


                mediaPart = MultipartBody.Part.createFormData("media", file.name, requestFile)

            } catch (e: Exception) {
                Log.e("PostActivity", "Error creating file part", e)
                Toast.makeText(this, "Error preparing file for upload.", Toast.LENGTH_SHORT).show()
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                return
            }
        }

        // The rest of the function (ApiClient call) remains identical.
        ApiClient.apiService.createPost(captionBody, mediaTypeBody, mediaPart)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    btnPost.isEnabled = true
                    progressBar.visibility = View.GONE

                    if (response.isSuccessful) {
                        Toast.makeText(this@PostActivity, "Post submitted for review!", Toast.LENGTH_SHORT).show()

                        // Redirect to PostApprovalActivity (admin review screen)
                        val intent = Intent(this@PostActivity, PostApprovalActivity::class.java)
                        startActivity(intent)
                        finish()

                    } else {
                        // Better error logging
                        val errorBody = response.errorBody()?.string()
                        Log.e("PostActivity", "❌ Upload failed - code: ${response.code()}, message: ${response.message()}, body: $errorBody")

                        // Specific server-side message if available
                        val errorMessage = try {
                            JSONObject(errorBody ?: "{}").optString("message", "Failed to upload post.")
                        } catch (e: Exception) {
                            "Failed to upload post."
                        }

                        Toast.makeText(this@PostActivity, errorMessage, Toast.LENGTH_LONG).show()
                    }

                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    btnPost.isEnabled = true
                    progressBar.visibility = View.GONE
                    Log.e("PostActivity", "Error: ${t.message}", t)
                    Toast.makeText(this@PostActivity, "Error: ${t.message}", Toast.LENGTH_SHORT)
                        .show()
                }
            })
    }

    // ✅ REPLACE getRealPathFromURI with this NEW, ROBUST FUNCTION
    private fun getFileFromUri(uri: Uri): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            // Create a temporary file in the app's cache directory
            val tempFile = File.createTempFile("upload_", ".tmp", cacheDir)
            tempFile.outputStream().use { outputStream ->
                inputStream.copyTo(outputStream)
            }
            inputStream.close()
            tempFile
        } catch (e: IOException) {
            Log.e("PostActivity", "Failed to copy URI content to file", e)
            null
        }
    }
}