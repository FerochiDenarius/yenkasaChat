package xyz.yenkasa.app.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Post
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.io.File
import java.io.IOException

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

    // 🎯 Each media type handled separately
    private var imageUri: Uri? = null
    private var videoUri: Uri? = null
    private var audioUri: Uri? = null

    companion object {
        private const val PICK_MEDIA_REQUEST = 101
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post)

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
        progressBar = findViewById(R.id.progressBar)
        spinnerCommunity = findViewById(R.id.spinnerCommunity)

        fetchCommunities()

        // Permission check
        if (!TokenManager.canPost(this)) {
            Toast.makeText(this, "You are not allowed to post.", Toast.LENGTH_LONG).show()
            btnPost.isEnabled = false
            btnPost.alpha = 0.5f
            btnChooseMedia.isEnabled = false
            btnChooseMedia.alpha = 0.5f
        }

        // 🔹 Choose Media
        btnChooseMedia.setOnClickListener {
            val intent = Intent(Intent.ACTION_GET_CONTENT)
            intent.type = "*/*"
            intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "audio/*"))
            startActivityForResult(Intent.createChooser(intent, "Select Media"), PICK_MEDIA_REQUEST)
        }

        // 🔹 Post Button
        btnPost.setOnClickListener {
            val content = editTextContent.text.toString().trim()
            if (content.isEmpty() && imageUri == null && videoUri == null && audioUri == null) {
                Toast.makeText(this, "Add text or media before posting.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            uploadPost(content)
        }
    }

    // 🔹 Handle selected media
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_MEDIA_REQUEST && resultCode == Activity.RESULT_OK && data?.data != null) {
            val uri = data.data ?: return

            val mimeType = contentResolver.getType(uri) ?: ""
            when {
                mimeType.startsWith("image") -> {
                    imageUri = uri
                    videoUri = null
                    audioUri = null
                    Log.d("PostActivity", "🖼️ Image selected: $uri")
                }
                mimeType.startsWith("video") -> {
                    videoUri = uri
                    imageUri = null
                    audioUri = null
                    Log.d("PostActivity", "🎬 Video selected: $uri")
                }
                mimeType.startsWith("audio") -> {
                    audioUri = uri
                    imageUri = null
                    videoUri = null
                    Log.d("PostActivity", "🎧 Audio selected: $uri")
                }
                else -> {
                    Toast.makeText(this, "Unsupported file type.", Toast.LENGTH_SHORT).show()
                    return
                }
            }

            updatePreview()
        }
    }

    // 🔹 Update preview UI
    private fun updatePreview() {
        imagePreview.visibility = View.GONE
        videoPreview.visibility = View.GONE
        audioPreview.visibility = View.GONE

        when {
            imageUri != null -> {
                imagePreview.visibility = View.VISIBLE
                imagePreview.setImageURI(imageUri)
            }
            videoUri != null -> {
                videoPreview.visibility = View.VISIBLE
                videoPreview.setVideoURI(videoUri)
                videoPreview.start()
            }
            audioUri != null -> {
                audioPreview.visibility = View.VISIBLE
                audioPreview.text = "🎵 Audio selected: ${audioUri?.lastPathSegment}"
            }
        }
    }

    // 🔹 Upload post
    private fun uploadPost(content: String) {
        val token = TokenManager.getToken(this)
        if (token == null) {
            Toast.makeText(this, "Please log in again.", Toast.LENGTH_SHORT).show()
            return
        }

        btnPost.isEnabled = false
        progressBar.visibility = View.VISIBLE

        val textBody = RequestBody.create("text/plain".toMediaTypeOrNull(), content)
        val communityIdBody = RequestBody.create("text/plain".toMediaTypeOrNull(), selectedCommunityId ?: "")
        val communityNameBody = RequestBody.create(
            "text/plain".toMediaTypeOrNull(),
            spinnerCommunity.selectedItem?.toString() ?: ""
        )

        // Prepare correct media part
        var mediaPart: MultipartBody.Part? = null
        var fieldName = ""

        val uriToUpload = imageUri ?: videoUri ?: audioUri
        if (uriToUpload != null) {
            fieldName = when {
                imageUri != null -> "imageUrl"
                videoUri != null -> "videoUrl"
                audioUri != null -> "audioUrl"
                else -> "file"
            }

            try {
                val file = getFileFromUri(uriToUpload)
                if (file == null) throw IOException("File could not be read")

                val mime = contentResolver.getType(uriToUpload) ?: "application/octet-stream"
                val requestFile = file.asRequestBody(mime.toMediaTypeOrNull())
                mediaPart = MultipartBody.Part.createFormData(fieldName, file.name, requestFile)
            } catch (e: Exception) {
                Log.e("PostActivity", "Error preparing media", e)
                Toast.makeText(this, "Error preparing file for upload.", Toast.LENGTH_SHORT).show()
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                return
            }
        }

        ApiClient.apiService.createPost(
            textBody,
            communityIdBody,
            communityNameBody,
            mediaPart
        ).enqueue(object : Callback<Post> {
            override fun onResponse(call: Call<Post>, response: Response<Post>) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE

                if (response.isSuccessful) {
                    val post = response.body()
                    val userRole = TokenManager.getUserRole(this@PostActivity)
                    val isPrivileged = userRole == "admin" || userRole == "moderator" || userRole == "developer"

                    Toast.makeText(
                        this@PostActivity,
                        if (isPrivileged) "✅ Post published!" else "🕓 Post submitted for approval.",
                        Toast.LENGTH_SHORT
                    ).show()

                    Log.i("PostActivity", "✅ Post created: ${post?._id}")
                    setResult(Activity.RESULT_OK)
                    finish()
                } else {
                    Log.e("PostActivity", "❌ Error: ${response.errorBody()?.string()}")
                    Toast.makeText(this@PostActivity, "Failed (${response.code()})", Toast.LENGTH_SHORT).show()
                }
            }

            override fun onFailure(call: Call<Post>, t: Throwable) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                Log.e("PostActivity", "Upload failed", t)
                Toast.makeText(this@PostActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun getFileFromUri(uri: Uri): File? {
        return try {
            val inputStream = contentResolver.openInputStream(uri) ?: return null
            val tempFile = File.createTempFile("upload_", ".tmp", cacheDir)
            tempFile.outputStream().use { output -> inputStream.copyTo(output) }
            inputStream.close()
            tempFile
        } catch (e: IOException) {
            Log.e("PostActivity", "Failed to copy URI to file", e)
            null
        }
    }

    private fun fetchCommunities() {
        progressBar.visibility = View.VISIBLE
        val token = TokenManager.getToken(this) ?: return

        // 1️⃣ Fetch primary community
        ApiClient.apiService.getUserPrimaryCommunity("Bearer $token")
            .enqueue(object : Callback<UserPrimaryCommunityResponse> {
                override fun onResponse(
                    call: Call<UserPrimaryCommunityResponse>,
                    response: Response<UserPrimaryCommunityResponse>
                ) {
                    val primary = response.body()?.community

                    if (!response.isSuccessful || primary == null) {
                        Log.e("COMM_FETCH", "Primary community not found or API failed")
                        loadJoinedCommunitiesForPost(token, null)
                        return
                    }

                    // Safe access with `let` ensures primary is not null
                    primary.let {
                        Log.d("COMM_FETCH", "Primary community: ${it.displayName} (${it.id})")
                        // 2️⃣ Fetch joined communities
                        loadJoinedCommunitiesForPost(token, it)
                    }
                }

                override fun onFailure(call: Call<UserPrimaryCommunityResponse>, t: Throwable) {
                    Log.e("COMM_FETCH", "Primary community fetch failed: ${t.message}", t)
                    loadJoinedCommunitiesForPost(token, null)
                }
            })
    }

    private fun loadJoinedCommunitiesForPost(token: String, primary: Community?) {
        ApiClient.apiService.getJoinedCommunities("Bearer $token")
            .enqueue(object : Callback<JoinedCommunitiesResponse> {
                override fun onResponse(
                    call: Call<JoinedCommunitiesResponse>,
                    response: Response<JoinedCommunitiesResponse>
                ) {
                    progressBar.visibility = View.GONE
                    if (!response.isSuccessful || response.body() == null) {
                        Log.e("COMM_FETCH", "Joined communities fetch failed: ${response.code()}")
                        Toast.makeText(this@PostActivity, "Failed to load communities", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val joined = response.body()!!.communities
                    val finalList = mutableListOf<Community>()

                    // Add primary first (if exists and not duplicate)
                    primary?.let {
                        if (!joined.any { c -> c.id == primary.id }) {
                            finalList.add(primary)
                        }
                    }

                    // Add joined communities
                    finalList.addAll(joined)

                    if (finalList.isEmpty()) {
                        Toast.makeText(this@PostActivity, "You have no communities to post in", Toast.LENGTH_LONG).show()
                        btnPost.isEnabled = false
                        return
                    }

                    // Setup spinner
                    val adapter = ArrayAdapter(
                        this@PostActivity,
                        android.R.layout.simple_spinner_item,
                        finalList.map { it.displayName }
                    )
                    adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
                    spinnerCommunity.adapter = adapter

                    spinnerCommunity.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(parent: AdapterView<*>, view: View?, pos: Int, id: Long) {
                            selectedCommunityId = finalList[pos].id
                            Log.d("COMM_FETCH", "Selected community: ${finalList[pos].displayName} (${selectedCommunityId})")
                        }

                        override fun onNothingSelected(parent: AdapterView<*>) {
                            selectedCommunityId = null
                        }
                    }
                }

                override fun onFailure(call: Call<JoinedCommunitiesResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Log.e("COMM_FETCH", "Joined communities fetch failed: ${t.message}", t)
                    Toast.makeText(this@PostActivity, "Error fetching communities", Toast.LENGTH_SHORT).show()
                }
            })
    }
}
