package xyz.yenkasa.app.ui

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.Gravity
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.core.content.ContextCompat
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.CreatePostResponse
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.model.JoinedCommunitiesResponse
import xyz.yenkasa.app.model.UserPrimaryCommunityResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TextPostBackgrounds
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
import org.json.JSONObject
import kotlin.math.roundToInt

class PostActivity : AppCompatActivity() {

    private lateinit var editTextContent: EditText
    private lateinit var imagePreview: ImageView
    private lateinit var imagePreviewCount: TextView
    private lateinit var videoPreviewContainer: View
    private lateinit var videoPreview: VideoView
    private lateinit var videoPreviewThumbnail: ImageView
    private lateinit var videoPreviewPlayHint: TextView
    private lateinit var audioPreview: TextView
    private lateinit var btnChooseMedia: View
    private lateinit var btnPost: Button
    private lateinit var progressBar: ProgressBar
    private lateinit var spinnerCommunity: Spinner
    private lateinit var textBackgroundLabel: TextView
    private lateinit var textBackgroundPicker: LinearLayout
    private var textPostCharacterCount: TextView? = null
    private var selectedCommunityMeta: TextView? = null
    private var selectedCommunityNameText: TextView? = null
    private var selectedCommunityCardMeta: TextView? = null
    private var selectedCommunityIcon: ImageView? = null
    private var privacyChip: TextView? = null
    private var selectedCommunityId: String? = null
    private var selectedTextBackgroundColor: String = ""
    private var defaultContentBackground: Drawable? = null

    // 🎯 Each media type handled separately
    private var imageUri: Uri? = null
    private val imageUris = mutableListOf<Uri>()
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
        supportActionBar?.title = ""
        toolbar.navigationIcon = ContextCompat.getDrawable(this, R.drawable.ic_close)
        toolbar.setNavigationOnClickListener { finish() }

        editTextContent = findViewById(R.id.editTextContent)
        imagePreview = findViewById(R.id.imagePreview)
        imagePreviewCount = findViewById(R.id.imagePreviewCount)
        videoPreviewContainer = findViewById(R.id.videoPreviewContainer)
        videoPreview = findViewById(R.id.videoPreview)
        videoPreview.setOnPreparedListener { mediaPlayer ->
            val aspect = if (mediaPlayer.videoWidth > 0 && mediaPlayer.videoHeight > 0) {
                mediaPlayer.videoWidth.toFloat() / mediaPlayer.videoHeight.toFloat()
            } else {
                readVideoAspect(videoUri) ?: (9f / 16f)
            }
            resizePreview(videoPreview, aspect)
            videoPreview.setBackgroundColor(Color.TRANSPARENT)
            videoPreviewThumbnail.visibility = View.GONE
            videoPreviewPlayHint.visibility = View.GONE
            mediaPlayer.isLooping = true
            videoPreview.start()
        }
        videoPreview.setOnErrorListener { _, _, _ ->
            videoPreviewThumbnail.visibility = View.VISIBLE
            videoPreviewPlayHint.visibility = View.VISIBLE
            Toast.makeText(this, "Unable to preview this video, but it can still be uploaded.", Toast.LENGTH_SHORT).show()
            true
        }
        videoPreviewThumbnail = findViewById(R.id.videoPreviewThumbnail)
        videoPreviewPlayHint = findViewById(R.id.videoPreviewPlayHint)
        audioPreview = findViewById(R.id.audioPreview)
        btnChooseMedia = findViewById(R.id.btnChooseMedia)
        btnPost = findViewById(R.id.btnPost)
        progressBar = findViewById(R.id.progressBar)
        spinnerCommunity = findViewById(R.id.spinnerCommunity)
        textBackgroundLabel = findViewById(R.id.textBackgroundLabel)
        textBackgroundPicker = findViewById(R.id.textBackgroundPicker)
        textPostCharacterCount = findViewById(R.id.textPostCharacterCount)
        selectedCommunityMeta = findViewById(R.id.textSelectedCommunityMeta)
        selectedCommunityNameText = findViewById(R.id.textSelectedCommunityName)
        selectedCommunityCardMeta = findViewById(R.id.textSelectedCommunityCardMeta)
        selectedCommunityIcon = findViewById(R.id.imageSelectedCommunity)
        privacyChip = findViewById(R.id.privacyChip)
        findViewById<View>(R.id.selectCommunityCard).setOnClickListener {
            spinnerCommunity.performClick()
        }
        findViewById<TextView>(R.id.textSeeMoreStyles).setOnClickListener {
            Toast.makeText(this, "More post styles are coming soon.", Toast.LENGTH_SHORT).show()
        }
        findViewById<TextView>(R.id.textPostAuthorName).text =
            TokenManager.getUsername(this)?.takeIf { it.isNotBlank() } ?: "Yenkasa user"
        Glide.with(this)
            .load(TokenManager.getProfilePicUrl(this))
            .placeholder(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(findViewById<ImageView>(R.id.imagePostAuthor))
        defaultContentBackground = editTextContent.background

        setupTextBackgroundPicker()
        editTextContent.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                textPostCharacterCount?.text = "${s?.length ?: 0}/500"
                applyTextBackgroundPreview()
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })

        fetchCommunities()

        // Backend enforces posting limits and moderation.
        if (!TokenManager.canPost(this)) {
            Toast.makeText(
                this,
                "Your account may be restricted from posting right now.",
                Toast.LENGTH_LONG
            ).show()
        }

        // 🔹 Choose Media
        btnChooseMedia.setOnClickListener {
            openMediaPicker()
        }
        findViewById<View>(R.id.btnAddVideoPlaceholder).setOnClickListener {
            openMediaPicker()
        }
        findViewById<View>(R.id.btnAddAudioPlaceholder).setOnClickListener {
            openMediaPicker()
        }
        findViewById<View>(R.id.btnAddPollPlaceholder).setOnClickListener {
            Toast.makeText(this, "Polls are coming soon.", Toast.LENGTH_SHORT).show()
        }
        findViewById<View>(R.id.btnAddEventPlaceholder).setOnClickListener {
            Toast.makeText(this, "Events are coming soon.", Toast.LENGTH_SHORT).show()
        }
        findViewById<TextView>(R.id.btnDrafts).setOnClickListener {
            Toast.makeText(this, "Drafts are coming soon.", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btnSchedulePlaceholder).setOnClickListener {
            Toast.makeText(this, "Scheduling is coming soon.", Toast.LENGTH_SHORT).show()
        }
        findViewById<View>(R.id.communityReminderCard).setOnClickListener {
            Toast.makeText(this, "Community rules are coming soon.", Toast.LENGTH_SHORT).show()
        }

        // 🔹 Post Button
        btnPost.setOnClickListener {
            val content = editTextContent.text.toString().trim()
            if (content.isEmpty() && imageUris.isEmpty() && videoUri == null && audioUri == null) {
                Toast.makeText(this, "Add text or media before posting.", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            uploadPost(content)
        }
    }

    private fun openMediaPicker() {
        val intent = Intent(Intent.ACTION_GET_CONTENT)
        intent.type = "*/*"
        intent.putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*", "audio/*"))
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        startActivityForResult(Intent.createChooser(intent, "Select Media"), PICK_MEDIA_REQUEST)
    }

    // 🔹 Handle selected media
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_MEDIA_REQUEST && resultCode == Activity.RESULT_OK && data != null) {
            val selectedUris = mutableListOf<Uri>()
            data.clipData?.let { clip ->
                for (index in 0 until clip.itemCount) {
                    selectedUris.add(clip.getItemAt(index).uri)
                }
            }
            data.data?.let { selectedUris.add(it) }

            if (selectedUris.isEmpty()) return

            val firstMimeType = contentResolver.getType(selectedUris.first()) ?: ""
            when {
                firstMimeType.startsWith("image") -> {
                    val images = selectedUris.filter {
                        contentResolver.getType(it)?.startsWith("image") == true
                    }.take(10)

                    if (images.isEmpty()) {
                        Toast.makeText(this, "Select image files only.", Toast.LENGTH_SHORT).show()
                        return
                    }

                    imageUris.clear()
                    imageUris.addAll(images)
                    imageUri = imageUris.first()
                    videoUri = null
                    audioUri = null
                    Log.d("PostActivity", "🖼️ Images selected: ${imageUris.size}")
                }
                firstMimeType.startsWith("video") -> {
                    videoUri = selectedUris.first()
                    imageUris.clear()
                    imageUri = null
                    audioUri = null
                    Log.d("PostActivity", "🎬 Video selected: $videoUri")
                }
                firstMimeType.startsWith("audio") -> {
                    audioUri = selectedUris.first()
                    imageUris.clear()
                    imageUri = null
                    videoUri = null
                    Log.d("PostActivity", "🎧 Audio selected: $audioUri")
                }
                else -> {
                    Toast.makeText(this, "Unsupported file type.", Toast.LENGTH_SHORT).show()
                    return
                }
            }

            updatePreview()
            applyTextBackgroundPreview()
        }
    }

    // 🔹 Update preview UI
    private fun updatePreview() {
        imagePreview.visibility = View.GONE
        imagePreviewCount.visibility = View.GONE
        videoPreview.stopPlayback()
        videoPreviewContainer.visibility = View.GONE
        videoPreviewThumbnail.setImageDrawable(null)
        videoPreviewThumbnail.visibility = View.GONE
        videoPreviewPlayHint.visibility = View.GONE
        audioPreview.visibility = View.GONE

        when {
            imageUris.isNotEmpty() -> {
                imagePreview.visibility = View.VISIBLE
                imagePreview.setImageURI(imageUris.first())
                resizePreview(imagePreview, readImageAspect(imageUris.first()) ?: (4f / 5f))
                if (imageUris.size > 1) {
                    imagePreviewCount.visibility = View.VISIBLE
                    imagePreviewCount.text = "${imageUris.size} images selected"
                }
            }
            videoUri != null -> {
                videoPreviewContainer.visibility = View.VISIBLE
                videoPreview.visibility = View.VISIBLE
                videoPreviewThumbnail.visibility = View.VISIBLE
                videoPreviewPlayHint.visibility = View.VISIBLE
                createVideoThumbnail(videoUri)?.let { videoPreviewThumbnail.setImageBitmap(it) }
                val aspect = readVideoAspect(videoUri) ?: (9f / 16f)
                resizePreview(videoPreviewContainer, aspect)
                videoPreview.setVideoURI(videoUri)
            }
            audioUri != null -> {
                audioPreview.visibility = View.VISIBLE
                audioPreview.text = "🎵 Audio selected: ${audioUri?.lastPathSegment}"
            }
        }
    }

    private fun readImageAspect(uri: Uri): Float? {
        return try {
            contentResolver.openInputStream(uri)?.use { input ->
                val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                BitmapFactory.decodeStream(input, null, options)
                if (options.outWidth > 0 && options.outHeight > 0) {
                    options.outWidth.toFloat() / options.outHeight.toFloat()
                } else {
                    null
                }
            }
        } catch (e: Exception) {
            Log.w("PostActivity", "Unable to read image dimensions: ${e.message}")
            null
        }
    }

    private fun readVideoAspect(uri: Uri?): Float? {
        if (uri == null) return null
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(this, uri)
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toFloatOrNull()
            val height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toFloatOrNull()
            val rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
            retriever.release()
            if (width != null && height != null && width > 0f && height > 0f) {
                if (rotation == 90 || rotation == 270) height / width else width / height
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w("PostActivity", "Unable to read video dimensions: ${e.message}")
            null
        }
    }

    private fun createVideoThumbnail(uri: Uri?): Bitmap? {
        if (uri == null) return null
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(this, uri)
            val bitmap = retriever.getFrameAtTime(1_000_000, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            retriever.release()
            bitmap
        } catch (e: Exception) {
            Log.w("PostActivity", "Unable to create video thumbnail: ${e.message}")
            null
        }
    }

    private fun resizePreview(view: View, rawAspect: Float) {
        view.post {
            val aspect = rawAspect.coerceIn(9f / 16f, 16f / 9f)
            val availableWidth = view.width.takeIf { it > 0 }
                ?: (resources.displayMetrics.widthPixels - dp(56))
            val targetHeight = (availableWidth / aspect).roundToInt()
                .coerceIn(dp(180), dp(540))
            val params = view.layoutParams
            if (params.height != targetHeight) {
                params.height = targetHeight
                view.layoutParams = params
            }
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

    private fun setupTextBackgroundPicker() {
        val density = resources.displayMetrics.density
        textBackgroundPicker.removeAllViews()

        TextPostBackgrounds.options.forEach { color ->
            val isSelected = color == selectedTextBackgroundColor
            val tile = FrameLayout(this).apply {
                background = styleTileBackground(color, isSelected, density)
                contentDescription = if (color.isBlank()) "No text background" else "Text background $color"
                isClickable = true
                isFocusable = true
            }

            val label = TextView(this).apply {
                text = "Aa"
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                gravity = Gravity.CENTER
                setTextColor(styleTileTextColor(color))
            }
            tile.addView(label, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))

            if (isSelected) {
                val check = TextView(this).apply {
                    text = "✓"
                    textSize = 11f
                    typeface = Typeface.DEFAULT_BOLD
                    gravity = Gravity.CENTER
                    setTextColor(ContextCompat.getColor(this@PostActivity, R.color.yenkasa_black))
                    background = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(ContextCompat.getColor(this@PostActivity, R.color.yenkasa_amber))
                    }
                }
                val badgeSize = (18f * density).toInt()
                val badgeParams = FrameLayout.LayoutParams(badgeSize, badgeSize, Gravity.BOTTOM or Gravity.END)
                tile.addView(check, badgeParams)
            }

            tile.setOnClickListener {
                selectedTextBackgroundColor = color
                setupTextBackgroundPicker()
                applyTextBackgroundPreview()
            }

            val width = (50f * density).toInt()
            val height = (42f * density).toInt()
            val margin = (8f * density).toInt()
            tile.layoutParams = LinearLayout.LayoutParams(width, height).apply {
                marginEnd = margin
            }
            textBackgroundPicker.addView(tile)
        }
    }

    private fun styleTileBackground(color: String, selected: Boolean, density: Float): GradientDrawable {
        val normalized = TextPostBackgrounds.normalize(color)
        val fill = if (normalized.isBlank()) {
            ContextCompat.getColor(this, R.color.post_create_surface)
        } else {
            Color.parseColor(normalized)
        }
        val strokeColor = if (selected) {
            ContextCompat.getColor(this, R.color.post_create_accent)
        } else {
            ContextCompat.getColor(this, R.color.post_create_border)
        }
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 8f * density
            setColor(fill)
            setStroke(if (selected) (2f * density).toInt() else (1f * density).toInt(), strokeColor)
        }
    }

    private fun styleTileTextColor(color: String): Int {
        val normalized = TextPostBackgrounds.normalize(color)
        if (normalized.isBlank()) {
            return ContextCompat.getColor(this, R.color.post_create_primary_text)
        }
        val parsed = Color.parseColor(normalized)
        val luminance = (0.299 * Color.red(parsed) + 0.587 * Color.green(parsed) + 0.114 * Color.blue(parsed))
        return if (luminance > 150) Color.BLACK else Color.WHITE
    }

    private fun applyTextBackgroundPreview() {
        val hasMedia = imageUris.isNotEmpty() || videoUri != null || audioUri != null
        val hasText = editTextContent.text?.toString()?.trim()?.isNotEmpty() == true
        val shouldShowBackground = !hasMedia && hasText && selectedTextBackgroundColor.isNotBlank()

        textBackgroundLabel.alpha = if (hasMedia) 0.45f else 1f
        textBackgroundPicker.alpha = if (hasMedia) 0.45f else 1f
        textBackgroundPicker.isEnabled = !hasMedia
        for (index in 0 until textBackgroundPicker.childCount) {
            textBackgroundPicker.getChildAt(index).isEnabled = !hasMedia
        }

        if (shouldShowBackground) {
            TextPostBackgrounds.apply(editTextContent, selectedTextBackgroundColor, centered = false)
        } else {
            editTextContent.background = defaultContentBackground
            editTextContent.setTextColor(
                ContextCompat.getColor(this, R.color.post_create_primary_text)
            )
            editTextContent.setTypeface(Typeface.DEFAULT, Typeface.NORMAL)
            editTextContent.gravity = Gravity.TOP
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
        val mediaParts = mutableListOf<MultipartBody.Part>()
        val mediaUris = when {
            imageUris.isNotEmpty() -> imageUris.map { "imageUrl" to it }
            videoUri != null -> listOf("videoUrl" to videoUri!!)
            audioUri != null -> listOf("audioUrl" to audioUri!!)
            else -> emptyList()
        }

        for ((fieldName, uriToUpload) in mediaUris) {
            try {
                val file = getFileFromUri(uriToUpload)
                    ?: throw IOException("File could not be read")
                val mime = contentResolver.getType(uriToUpload) ?: "application/octet-stream"
                val requestFile = file.asRequestBody(mime.toMediaTypeOrNull())
                mediaParts.add(MultipartBody.Part.createFormData(fieldName, file.name, requestFile))
            } catch (e: Exception) {
                Log.e("PostActivity", "Error preparing media", e)
                Toast.makeText(this, "Error preparing file for upload.", Toast.LENGTH_SHORT).show()
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                return
            }
        }
        val textBackgroundColor = if (mediaParts.isEmpty() && content.isNotBlank()) {
            TextPostBackgrounds.normalize(selectedTextBackgroundColor)
        } else {
            ""
        }
        val textBackgroundColorBody = RequestBody.create(
            "text/plain".toMediaTypeOrNull(),
            textBackgroundColor
        )

        ApiClient.apiService.createPost(
            textBody,
            communityIdBody,
            communityNameBody,
            textBackgroundColorBody,
            mediaParts
        ).enqueue(object : Callback<CreatePostResponse> {
            override fun onResponse(
                call: Call<CreatePostResponse>,
                response: Response<CreatePostResponse>
            ) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE

                if (response.isSuccessful) {
                    val responseBody = response.body()
                    val requiresReview = responseBody?.postingAccess?.requiresReview ?: true
                    val toastMessage = responseBody?.message
                        ?: if (requiresReview) {
                            "Post submitted for approval."
                        } else {
                            "Post published successfully."
                        }

                    Toast.makeText(
                        this@PostActivity,
                        toastMessage,
                        Toast.LENGTH_LONG
                    ).show()

                    val postId = responseBody?.post?.get("_id")?.asString ?: "unknown"
                    Log.i("PostActivity", "Post created: $postId")
                    TokenManager.saveRecentPostedCommunity(this@PostActivity, selectedCommunityId)
                    setResult(Activity.RESULT_OK)
                    finish()
                } else {
                    val backendMessage = readBackendError(response)
                    Log.e("PostActivity", "Error response (${response.code()}): $backendMessage")

                    val message = when (response.code()) {
                        429 -> backendMessage.ifBlank {
                            "You have reached your limit of 5 posts within 48 hours."
                        }
                        403 -> backendMessage.ifBlank {
                            "Your account is currently restricted from posting."
                        }
                        404 -> backendMessage.ifBlank {
                            "Selected community was not found."
                        }
                        400 -> backendMessage.ifBlank {
                            "Please complete the post details correctly."
                        }
                        else -> backendMessage.ifBlank {
                            "Failed to create post (${response.code()})"
                        }
                    }

                    Toast.makeText(this@PostActivity, message, Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<CreatePostResponse>, t: Throwable) {
                btnPost.isEnabled = true
                progressBar.visibility = View.GONE
                Log.e("PostActivity", "Upload failed", t)
                Toast.makeText(this@PostActivity, "Error: ${t.message}", Toast.LENGTH_SHORT).show()
            }
        })
    }

    private fun readBackendError(response: Response<CreatePostResponse>): String {
        val errorText = try {
            response.errorBody()?.string().orEmpty()
        } catch (e: Exception) {
            ""
        }

        if (errorText.isBlank()) return ""

        return try {
            val json = JSONObject(errorText)
            json.optString("error").ifBlank {
                json.optString("message")
            }
        } catch (e: Exception) {
            errorText
        }
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
                        R.layout.item_create_post_spinner,
                        R.id.textCreatePostSpinner,
                        finalList.map { it.displayName ?: it.name ?: "Unnamed community" }
                    )
                    adapter.setDropDownViewResource(R.layout.item_create_post_spinner_dropdown)
                    spinnerCommunity.adapter = adapter

                    spinnerCommunity.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(parent: AdapterView<*>, view: View?, pos: Int, id: Long) {
                            val selected = finalList[pos]
                            selectedCommunityId = selected.id
                            selectedCommunityMeta?.text = buildCommunityMeta(selected)
                            updateSelectedCommunityCard(selected)
                            Log.d("COMM_FETCH", "Selected community: ${selected.displayName} (${selectedCommunityId})")
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

    private fun buildCommunityMeta(community: Community): String {
        val privacy = if (community.isPrivate) "Private" else "Public"
        val memberText = when (community.memberCount) {
            0 -> "New community"
            1 -> "1 member"
            else -> "${community.memberCount} members"
        }
        return "$memberText - $privacy"
    }

    private fun updateSelectedCommunityCard(community: Community) {
        val name = community.displayName ?: community.name ?: "Unnamed community"
        selectedCommunityNameText?.text = name
        selectedCommunityCardMeta?.text = buildCommunityMeta(community)
        privacyChip?.text = if (community.isPrivate) "Private" else "Public"

        val imageUrl = community.icon?.takeIf { it.isNotBlank() }
            ?: community.coverImage?.takeIf { it.isNotBlank() }
        selectedCommunityIcon?.let { icon ->
            Glide.with(this)
                .load(imageUrl)
                .placeholder(R.drawable.ic_community_placeholder)
                .error(R.drawable.ic_community_placeholder)
                .circleCrop()
                .into(icon)
        }
    }
}
