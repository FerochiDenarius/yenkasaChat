package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException
import org.json.JSONObject

class PostActivity : AppCompatActivity() {

    private lateinit var editTextContent: EditText
    private lateinit var imagePreview: ImageView
    private lateinit var videoPreview: VideoView
    private lateinit var audioPreview: TextView
    private lateinit var btnChooseMedia: Button
    private lateinit var btnPost: Button
    private lateinit var progressBar: ProgressBar

    private var mediaUri: Uri? = null
    private var mediaType: String? = null

    companion object {
        private const val PICK_MEDIA_REQUEST = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post)

        // 🔹 Toolbar setup
        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "Create Post"
        toolbar.setNavigationOnClickListener { finish() }

        // 🔹 Initialize UI
        editTextContent = findViewById(R.id.editTextContent)
        imagePreview = findViewById(R.id.imagePreview)
        videoPreview = findViewById(R.id.videoPreview)
        audioPreview = findViewById(R.id.audioPreview)
        btnChooseMedia = findViewById(R.id.btnChooseMedia)
        btnPost = findViewById(R.id.btnPost)
        progressBar = findViewById(R.id.progressBar)

        // ✅ Check if the user is verified via TokenManager
        val isVerified = TokenManager.isVerified(this)
        if (!isVerified) {
            Toast.makeText(
                this,
                "Only verified users can create posts.",
                Toast.LENGTH_LONG
            ).show()
            btnPost.isEnabled = false
            btnPost.alpha = 0.5f
            btnChooseMedia.isEnabled = false
            btnChooseMedia.alpha = 0.5f
        }

        // 🔹 Choose Media Button
        btnChooseMedia.setOnClickListener {
            if (!isVerified) {
                Toast.makeText(this, "You must be verified to select media.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "audio/*"))
            startActivityForResult(Intent.createChooser(intent, "Select Media"), PICK_MEDIA_REQUEST)
        }

        // 🔹 Post Button
        btnPost.setOnClickListener {
            if (!isVerified) {
                Toast.makeText(this, "Only verified users can post.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val content = editTextContent.text.toString().trim()
            if (content.isEmpty() && mediaUri == null) {
                Toast.makeText(this, "Add text or media before posting.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            uploadPost(content)
        }
    }

    // 🔹 Handle media selection result
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

    // 🔹 Display selected media preview
    private fun updatePreview() {
        imagePreview.visibility = View.GONE
        videoPreview.visibility = View.GONE
        audioPreview.visibility = View.GONE

        when (mediaType) {
            "image" -> {
                imagePreview.visibility = View.VISIBLE
                imagePreview.setImageURI(mediaUri)
            }
            "video" -> {
                videoPreview.visibility = View.VISIBLE
                videoPreview.setVideoURI(mediaUri)
                videoPreview.start()
            }
            "audio" -> {
                audioPreview.visibility = View.VISIBLE
                audioPreview.text = "🎵 Audio selected: ${mediaUri?.lastPathSegment}"
            }
        }
    }

    // 🔹 Upload post to backend
    private fun uploadPost(content: String) {
        val token = TokenManager.getToken(this)
        if (token == null) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            return
        }

        btnPost.isEnabled = false
        progressBar.visibility = View.VISIBLE

        val textBody = RequestBody.create("text/plain".toMediaTypeOrNull(), content)
        var mediaPart: MultipartBody.Part? = null

        mediaUri?.let { uri ->
            try {
                val file = getFileFromUri(uri)
                if (file == null) throw IOException("Failed to create file from Uri")

                val mime = contentResolver.getType(uri) ?: "application/octet-stream"
                val requestFile = RequestBody.create(mime.toMediaTypeOrNull(), file)
                mediaPart = MultipartBody.Part.createFormData("media", file.name, requestFile)
            } catch (e: Exception) {
                Log.e("PostActivity", "Error preparing media file", e)
                Toast.makeText(this, "Error preparing file for upload.", Toast.LENGTH_SHORT).show()
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                return
            }
        }

        ApiClient.apiService.createPost(
            textBody,
            RequestBody.create("text/plain".toMediaTypeOrNull(), mediaType ?: "text"),
            mediaPart
        ).enqueue(object : Callback<Post> {
            override fun onResponse(call: Call<Post>, response: Response<Post>) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE

                if (response.isSuccessful) {
                    Toast.makeText(this@PostActivity, "✅ Post created successfully!", Toast.LENGTH_SHORT).show()
                    setResult(Activity.RESULT_OK)
                    finish()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val message = try {
                        JSONObject(errorBody ?: "{}").optString("error", "Failed to upload post.")
                    } catch (e: Exception) {
                        "Failed to upload post."
                    }
                    Log.e("PostActivity", "Upload failed: $message")
                    Toast.makeText(this@PostActivity, message, Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<Post>, t: Throwable) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                Log.e("PostActivity", "Error: ${t.message}", t)
                Toast.makeText(this@PostActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // 🔹 Convert Uri → File safely
    private fun getFileFromUri(uri: Uri): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("upload_", ".tmp", cacheDir)
            tempFile.outputStream().use { output -> inputStream.copyTo(output) }
            inputStream.close()
            tempFile
        } catch (e: IOException) {
            Log.e("PostActivity", "Failed to copy URI content to file", e)
            null
        }
    }
}
