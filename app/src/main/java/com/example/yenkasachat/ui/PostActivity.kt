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
import com.example.yenkasachat.model.Community
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.ui.CommunitiesActivity
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
    private lateinit var spinnerCommunity: Spinner
    private var selectedCommunityId: String? = null


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
        spinnerCommunity = findViewById(R.id.spinnerCommunity)
        fetchCommunities()


        // ✅ Check if the user is verified via TokenManager
        val canPost = TokenManager.canPost(this)
        if (!canPost) {
            Log.w("PostAccessCheck", "User cannot post — verification or support issue detected.")

            Toast.makeText(
                this,
                "You are not allowed to post. Please verify your account or contact support.",
                Toast.LENGTH_LONG
            ).show()

            btnPost.isEnabled = false
            btnPost.alpha = 0.5f
            Log.d("PostAccessCheck", "Disabled Post button (isEnabled=${btnPost.isEnabled}, alpha=${btnPost.alpha})")

            btnChooseMedia.isEnabled = false
            btnChooseMedia.alpha = 0.5f
            Log.d("PostAccessCheck", "Disabled Media button (isEnabled=${btnChooseMedia.isEnabled}, alpha=${btnChooseMedia.alpha})")

            Log.i("PostAccessCheck", "UI updated to reflect restricted posting access.")
        }


        // 🔹 Choose Media Button
        btnChooseMedia.setOnClickListener {
            if (!TokenManager.canPost(this)) {
                Toast.makeText(this, "You don't have permission to select media.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "audio/*"))
            startActivityForResult(Intent.createChooser(intent, "Select Media"), PICK_MEDIA_REQUEST)
        }

        // 🔹 Post Button
        btnPost.setOnClickListener {
            if (!TokenManager.canPost(this)) {
                Toast.makeText(this, "You don't have permission to post.", Toast.LENGTH_SHORT).show()
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

        val communityBody = RequestBody.create("text/plain".toMediaTypeOrNull(), selectedCommunityId ?: "")

        ApiClient.apiService.createPost(
            textBody,
            RequestBody.create("text/plain".toMediaTypeOrNull(), mediaType ?: "text"),
            communityBody,
            mediaPart
        )
            .enqueue(object : Callback<Post> {
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


    private fun fetchCommunities() {
        progressBar.visibility = View.VISIBLE

        val token = TokenManager.getToken(this)
        if (token == null) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.getCommunities("Bearer $token").enqueue(object : Callback<List<Community>> {
            override fun onResponse(call: Call<List<Community>>, response: Response<List<Community>>) {
                progressBar.visibility = View.GONE
                if (response.isSuccessful) {
                    val communities = response.body() ?: emptyList()
                    if (communities.isNotEmpty()) {
                        val adapter = ArrayAdapter(
                            this@PostActivity,
                            android.R.layout.simple_spinner_item,
                            communities.map { it.displayName }
                        )
                        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                        spinnerCommunity.adapter = adapter

                        spinnerCommunity.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                            override fun onItemSelected(
                                parent: AdapterView<*>, view: View?, position: Int, id: Long
                            ) {
                                selectedCommunityId = communities[position].id
                                // Enable buttons now that a community is selected
                                btnChooseMedia.isEnabled = true
                                btnChooseMedia.alpha = 1f
                                btnPost.isEnabled = true
                                btnPost.alpha = 1f
                            }

                            override fun onNothingSelected(parent: AdapterView<*>) {
                                selectedCommunityId = null
                            }
                        }
                    } else {
                        Toast.makeText(this@PostActivity, "No communities available.", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(this@PostActivity, "Failed to load communities.", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<List<Community>>, t: Throwable) {
                progressBar.visibility = View.GONE
                Toast.makeText(this@PostActivity, "Error fetching communities: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

}

