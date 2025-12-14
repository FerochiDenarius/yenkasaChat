package xyz.yenkasa.app.ui

import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

class CreateAdActivity : AppCompatActivity() {

    private lateinit var inputAdTitle: EditText
    private lateinit var previewAdImage: ImageView
    private lateinit var previewAdVideo: VideoView
    private lateinit var previewAdThumb: ImageView

    private lateinit var btnUploadImage: Button
    private lateinit var btnUploadVideo: Button
    private lateinit var btnUploadThumb: Button
    private lateinit var btnSubmitAd: Button

    private lateinit var inputCtaText: EditText
    private lateinit var inputCtaUrl: EditText
    private lateinit var inputReward: EditText

    private var imageUri: Uri? = null
    private var videoUri: Uri? = null
    private var thumbUri: Uri? = null

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            imageUri = uri
            previewAdImage.visibility = ImageView.VISIBLE
            Glide.with(this).load(uri).into(previewAdImage)
        }
    }

    private val pickVideoLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            videoUri = uri
            previewAdVideo.visibility = VideoView.VISIBLE
            previewAdVideo.setVideoURI(uri)
            previewAdVideo.start()
        }
    }

    private val pickThumbLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            thumbUri = uri
            previewAdThumb.visibility = ImageView.VISIBLE
            Glide.with(this).load(uri).into(previewAdThumb)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_ad)

        initViews()
        setupClicks()
    }

    private fun initViews() {
        inputAdTitle = findViewById(R.id.inputAdTitle)
        previewAdImage = findViewById(R.id.previewAdImage)
        previewAdVideo = findViewById(R.id.previewAdVideo)
        previewAdThumb = findViewById(R.id.previewAdThumb)

        btnUploadImage = findViewById(R.id.btnUploadImage)
        btnUploadVideo = findViewById(R.id.btnUploadVideo)
        btnUploadThumb = findViewById(R.id.btnUploadThumb)
        btnSubmitAd = findViewById(R.id.btnSubmitAd)

        inputCtaText = findViewById(R.id.inputCtaText)
        inputCtaUrl = findViewById(R.id.inputCtaUrl)
        inputReward = findViewById(R.id.inputReward)
    }

    private fun setupClicks() {
        btnUploadImage.setOnClickListener { pickImageLauncher.launch("image/*") }
        btnUploadVideo.setOnClickListener { pickVideoLauncher.launch("video/*") }
        btnUploadThumb.setOnClickListener { pickThumbLauncher.launch("image/*") }
        btnSubmitAd.setOnClickListener { submitAd() }
    }

    private fun submitAd() {
        val title = inputAdTitle.text.toString().trim()
        val ctaText = inputCtaText.text.toString().trim()
        val ctaUrl = inputCtaUrl.text.toString().trim()
        val rewardText = inputReward.text.toString().trim()

        if (title.isEmpty()) {
            inputAdTitle.error = "Title is required"
            return
        }

        if (rewardText.isEmpty()) {
            inputReward.error = "Reward is required"
            return
        }

        val reward = rewardText.toIntOrNull()
        if (reward == null || reward <= 0) {
            inputReward.error = "Invalid reward amount"
            return
        }

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val token = TokenManager.getToken(this@CreateAdActivity)
                if (token == null) {
                    showToast("Login required")
                    return@launch
                }

                val imagePart = imageUri?.let { prepareFilePart("image", it) }
                val videoPart = videoUri?.let { prepareFilePart("video", it) }
                val thumbPart = thumbUri?.let { prepareFilePart("thumbnail", it) }

                val request = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("title", title)
                    .addFormDataPart("ctaText", ctaText)
                    .addFormDataPart("ctaUrl", ctaUrl)
                    .addFormDataPart("rewardAmount", reward.toString())
                    .apply {
                        if (imagePart != null) addPart(imagePart)
                        if (videoPart != null) addPart(videoPart)
                        if (thumbPart != null) addPart(thumbPart)
                    }
                    .build()

                val response = ApiClient.apiService.createSponsoredAd(
                    "Bearer $token",
                    request
                ).execute()

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        showToast("Ad submitted successfully!")
                        finish()
                    } else {
                        showToast("Failed: ${response.errorBody()?.string()}")
                    }
                }

            } catch (e: Exception) {
                Log.e("CreateAd", "Error submitting ad: ${e.message}")
                withContext(Dispatchers.Main) {
                    showToast("Error: ${e.message}")
                }
            }
        }
    }

    private fun prepareFilePart(fieldName: String, uri: Uri): MultipartBody.Part {
        val file = File(cacheDir, "upload_${System.currentTimeMillis()}")
        val input = contentResolver.openInputStream(uri)!!
        file.outputStream().use { output -> input.copyTo(output) }

        val mime = contentResolver.getType(uri) ?: "image/*"
        val request = file.asRequestBody(mime.toMediaTypeOrNull())

        return MultipartBody.Part.createFormData(fieldName, file.name, request)
    }

    private fun showToast(msg: String) {
        runOnUiThread {
            Toast.makeText(this@CreateAdActivity, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
