package xyz.yenkasa.app.ui

import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UploadMediaOptimizer
import xyz.yenkasa.app.util.UserPermissions
import xyz.yenkasa.app.util.WalletBalanceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File

class CreateAdActivity : AppCompatActivity() {

    private lateinit var inputAdTitle: EditText
    private lateinit var previewAdImage: ImageView
    private lateinit var previewAdVideo: YenkasaVideoPlayerView
    private lateinit var previewAdThumb: ImageView
    private lateinit var imageAdVideoPlaceholder: ImageView

    private lateinit var btnUploadImage: Button
    private lateinit var btnUploadVideo: Button
    private lateinit var btnUploadThumb: Button
    private lateinit var btnSubmitAd: Button
    private lateinit var btnBackCreateAd: ImageButton
    private lateinit var textAdWalletBalance: TextView
    private lateinit var textAdTitleCount: TextView

    private lateinit var inputCtaText: EditText
    private lateinit var inputCtaUrl: EditText
    private lateinit var inputReward: EditText

    private var imageUri: Uri? = null
    private var videoUri: Uri? = null
    private var thumbUri: Uri? = null
    private var isSubmittingAd = false

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            imageUri = uri
            previewAdImage.visibility = ImageView.VISIBLE
            previewAdImage.clearColorFilter()
            Glide.with(this).load(uri).into(previewAdImage)
        }
    }

    private val pickVideoLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            videoUri = uri
            previewAdVideo.visibility = ImageView.VISIBLE
            imageAdVideoPlaceholder.visibility = ImageView.VISIBLE
            imageAdVideoPlaceholder.clearColorFilter()
            Glide.with(this).load(uri).into(imageAdVideoPlaceholder)
            previewAdVideo.visibility = ImageView.VISIBLE
            previewAdVideo.bindVideo(
                mediaUrl = uri.toString(),
                thumbnailUrl = uri.toString(),
                autoplay = true,
                muted = true,
                loop = true
            )
        }
    }

    private val pickThumbLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            thumbUri = uri
            previewAdThumb.visibility = ImageView.VISIBLE
            previewAdThumb.clearColorFilter()
            Glide.with(this).load(uri).into(previewAdThumb)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_ad)

        if (!canCurrentUserCreateAd()) {
            Toast.makeText(
                this,
                getString(R.string.create_ads_requires_verified),
                Toast.LENGTH_LONG
            ).show()
            finish()
            return
        }

        initViews()
        setupClicks()
        setupTextCounter()
        updateWalletBalance()
    }

    private fun initViews() {
        inputAdTitle = findViewById(R.id.inputAdTitle)
        previewAdImage = findViewById(R.id.previewAdImage)
        previewAdVideo = findViewById(R.id.previewAdVideo)
        previewAdThumb = findViewById(R.id.previewAdThumb)
        imageAdVideoPlaceholder = findViewById(R.id.imageAdVideoPlaceholder)

        btnUploadImage = findViewById(R.id.btnUploadImage)
        btnUploadVideo = findViewById(R.id.btnUploadVideo)
        btnUploadThumb = findViewById(R.id.btnUploadThumb)
        btnSubmitAd = findViewById(R.id.btnSubmitAd)
        btnBackCreateAd = findViewById(R.id.btnBackCreateAd)
        textAdWalletBalance = findViewById(R.id.textAdWalletBalance)
        textAdTitleCount = findViewById(R.id.textAdTitleCount)

        inputCtaText = findViewById(R.id.inputCtaText)
        inputCtaUrl = findViewById(R.id.inputCtaUrl)
        inputReward = findViewById(R.id.inputReward)

        previewAdVideo.setReadyListener {
            imageAdVideoPlaceholder.visibility = ImageView.GONE
        }
    }

    private fun setupClicks() {
        btnUploadImage.setOnClickListener { pickImageLauncher.launch("image/*") }
        btnUploadVideo.setOnClickListener { pickVideoLauncher.launch("video/*") }
        btnUploadThumb.setOnClickListener { pickThumbLauncher.launch("image/*") }
        btnSubmitAd.setOnClickListener { submitAd() }
        btnBackCreateAd.setOnClickListener { finish() }
    }

    private fun setupTextCounter() {
        textAdTitleCount.text = getString(R.string.create_ad_title_count_format, inputAdTitle.text?.length ?: 0)
        inputAdTitle.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                textAdTitleCount.text = getString(R.string.create_ad_title_count_format, s?.length ?: 0)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun updateWalletBalance() {
        textAdWalletBalance.text = getString(R.string.ykc_amount_format, TokenManager.getCoins(this))
        WalletBalanceManager.refreshBalance(this) { balance ->
            runOnUiThread {
                textAdWalletBalance.text = getString(R.string.ykc_amount_format, balance)
            }
        }
    }

    private fun canCurrentUserCreateAd(): Boolean {
        return isCurrentUserVerified() || UserPermissions.canCreateAd(resolveCurrentRole())
    }

    private fun resolveCurrentRole(): String {
        val userJson = TokenManager.getUser(this)
        if (!userJson.isNullOrBlank()) {
            runCatching {
                val json = JSONObject(userJson)
                val roleName = json.optString("roleName").takeIf { it.isNotBlank() }
                if (roleName != null) return roleName

                val roleValue = json.opt("role")
                when (roleValue) {
                    is JSONObject -> roleValue.optString("name").takeIf { it.isNotBlank() }?.let { return it }
                    is String -> roleValue.takeIf { it.isNotBlank() }?.let { return it }
                }
            }.onFailure {
                Log.w("CreateAd", "Unable to parse saved role JSON: ${it.message}")
            }
        }
        return TokenManager.getUserRole(this)
    }

    private fun isCurrentUserVerified(): Boolean {
        val userJson = TokenManager.getUser(this)
        if (!userJson.isNullOrBlank()) {
            runCatching {
                val json = JSONObject(userJson)
                if (json.optBoolean("verified", false)) return true
            }
        }
        return TokenManager.isVerified(this)
    }

    private fun submitAd() {
        if (isSubmittingAd) return
        val title = inputAdTitle.text.toString().trim()
        val ctaText = inputCtaText.text.toString().trim()
        val ctaUrl = inputCtaUrl.text.toString().trim()
        val rewardText = inputReward.text.toString().trim()

        if (title.isEmpty()) {
            inputAdTitle.error = getString(R.string.create_ad_title_required)
            return
        }

        if (rewardText.isEmpty()) {
            inputReward.error = getString(R.string.create_ad_reward_required)
            return
        }

        val reward = rewardText.toIntOrNull()
        if (reward == null || reward <= 0) {
            inputReward.error = getString(R.string.create_ad_reward_invalid)
            return
        }

        if (imageUri == null && videoUri == null) {
            showToast(getString(R.string.create_ad_media_required))
            return
        }

        isSubmittingAd = true
        btnSubmitAd.isEnabled = false
        btnSubmitAd.text = getString(R.string.create_ad_submitting)
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val token = TokenManager.getToken(this@CreateAdActivity)
                if (token == null) {
                    showToast(getString(R.string.login_required))
                    resetSubmitButton()
                    return@launch
                }

                val imagePart = imageUri?.let { prepareFilePart("image", it) }
                val videoPart = videoUri?.let { prepareFilePart("video", it) }
                val thumbPart = thumbUri?.let { prepareFilePart("thumbnail", it) }

                var response = ApiClient.apiService.createSponsoredAd(
                    "Bearer $token",
                    textPart(title),
                    textPart(ctaText),
                    textPart(ctaUrl),
                    textPart(reward.toString()),
                    textPart(reward.toString()),
                    textPart("sponsor"),
                    textPart("global"),
                    textPart("all"),
                    imagePart,
                    videoPart,
                    thumbPart
                ).execute()

                if (response.code() == 404 || response.code() == 405) {
                    response = ApiClient.apiService.createSponsoredAdFallback(
                        "Bearer $token",
                        textPart(title),
                        textPart(ctaText),
                        textPart(ctaUrl),
                        textPart(reward.toString()),
                        textPart(reward.toString()),
                        textPart("sponsor"),
                        textPart("global"),
                        textPart("all"),
                        imagePart,
                        videoPart,
                        thumbPart
                    ).execute()
                }

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body()?.success == true) {
                        showToast(response.body()?.message ?: getString(R.string.create_ad_submitted_for_approval))
                        finish()
                    } else {
                        showToast(
                            getString(
                                R.string.create_ad_failed_with_code,
                                response.code(),
                                readBackendError(response.errorBody()?.string())
                            )
                        )
                        resetSubmitButton()
                    }
                }

            } catch (e: Exception) {
                Log.e("CreateAd", "Error submitting ad: ${e.message}")
                withContext(Dispatchers.Main) {
                    val message = e.message?.takeIf { it.isNotBlank() } ?: getString(R.string.create_ad_unknown_server_error)
                    showToast(getString(R.string.create_ad_error_with_message, message))
                    resetSubmitButton()
                }
            }
        }
    }

    private fun prepareFilePart(fieldName: String, uri: Uri): MultipartBody.Part {
        val mediaType = when (fieldName) {
            "image", "thumbnail" -> "image"
            "video" -> "video"
            else -> "file"
        }
        val file = UploadMediaOptimizer.prepareForUpload(
            context = this,
            uri = uri,
            type = mediaType,
            maxImageDimension = 1600,
            jpegQuality = 82
        ) ?: File(cacheDir, "upload_${System.currentTimeMillis()}").also { outputFile ->
            val input = contentResolver.openInputStream(uri)!!
            outputFile.outputStream().use { output -> input.copyTo(output) }
        }

        val mime = contentResolver.getType(uri) ?: "image/*"
        val request = file.asRequestBody(mime.toMediaTypeOrNull())

        return MultipartBody.Part.createFormData(fieldName, file.name, request)
    }

    private fun textPart(value: String): RequestBody {
        return value.toRequestBody("text/plain".toMediaTypeOrNull())
    }

    private fun showToast(msg: String) {
        runOnUiThread {
            Toast.makeText(this@CreateAdActivity, msg, Toast.LENGTH_SHORT).show()
        }
    }

    private fun resetSubmitButton() {
        runOnUiThread {
            isSubmittingAd = false
            btnSubmitAd.isEnabled = true
            btnSubmitAd.text = getString(R.string.submit_ad)
        }
    }

    private fun readBackendError(errorText: String?): String {
        if (errorText.isNullOrBlank()) return getString(R.string.create_ad_unknown_server_error)
        return runCatching {
            val json = JSONObject(errorText)
            json.optString("message").ifBlank {
                json.optString("error").ifBlank { errorText }
            }
        }.getOrDefault(errorText)
    }

    override fun onStop() {
        super.onStop()
        if (::previewAdVideo.isInitialized) previewAdVideo.pause()
    }

    override fun onDestroy() {
        if (::previewAdVideo.isInitialized) previewAdVideo.release()
        super.onDestroy()
    }
}
