package com.example.yenkasachat.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
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
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File

class PostActivity : AppCompatActivity() {

    private lateinit var editTextContent: EditText
    private lateinit var imagePreview: ImageView
    private lateinit var videoPreview: VideoView
    private lateinit var audioPreview: TextView
    private lateinit var btnChooseMedia: Button
    private lateinit var btnPost: Button
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

        btnChooseMedia.setOnClickListener {
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

    private fun uploadPost(content: String) {
        val token = TokenManager.getToken(this)
        val userId = TokenManager.getUserId(this)

        if (token == null || userId == null) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            return
        }

        // Build RequestBody for caption
        val captionBody = RequestBody.create("text/plain".toMediaTypeOrNull(), content)

        // Build RequestBody for mediaType (send "text" when no media selected)
        val mediaTypeString = mediaType ?: "text"
        val mediaTypeBody = RequestBody.create("text/plain".toMediaTypeOrNull(), mediaTypeString)

        // Build MultipartBody.Part only if there is a media URI
        var mediaPart: MultipartBody.Part? = null
        mediaUri?.let { uri ->
            // create a temp file for upload (you already have getRealPathFromURI helper)
            val file = File(getRealPathFromURI(uri))
            val mime = contentResolver.getType(uri) ?: "application/octet-stream"
            val requestFile = RequestBody.create(mime.toMediaTypeOrNull(), file)
            // 'media' is the field name your backend expects for the file part; adjust if backend uses another name
            mediaPart = MultipartBody.Part.createFormData("media", file.name, requestFile)
        }

        // NOTE: many backends accept nullable mediaPart; if your ApiService signature is:
        // fun createPost(caption: RequestBody, mediaType: RequestBody, mediaFile: MultipartBody.Part?): Call<Post>
        // then the call below matches that signature.
        ApiClient.apiService.createPost(captionBody, mediaTypeBody, mediaPart)
            .enqueue(object : Callback<Post> {
                override fun onResponse(call: Call<Post>, response: Response<Post>) {
                    if (response.isSuccessful) {
                        Toast.makeText(this@PostActivity, "Post uploaded!", Toast.LENGTH_SHORT).show()
                        finish()
                    } else {
                        Log.e("PostActivity", "Upload failed - code: ${response.code()}, msg: ${response.message()}")
                        Toast.makeText(this@PostActivity, "Failed to upload post.", Toast.LENGTH_SHORT).show()
                    }
                }

                override fun onFailure(call: Call<Post>, t: Throwable) {
                    Log.e("PostActivity", "Error: ${t.message}", t)
                    Toast.makeText(this@PostActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
                }
            })
    }

    private fun getRealPathFromURI(uri: Uri): String {
        val inputStream = contentResolver.openInputStream(uri)
        val tempFile = File.createTempFile("upload", null, cacheDir)
        inputStream?.use { input -> tempFile.outputStream().use { input.copyTo(it) } }
        return tempFile.absolutePath
    }
}
