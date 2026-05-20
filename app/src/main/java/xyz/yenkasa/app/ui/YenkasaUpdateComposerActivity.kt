package xyz.yenkasa.app.ui

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.OpenableColumns
import android.text.InputFilter
import android.text.method.LinkMovementMethod
import android.view.LayoutInflater
import android.view.View
import android.widget.AutoCompleteTextView
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.core.content.ContextCompat
import androidx.core.text.HtmlCompat
import androidx.core.view.WindowCompat
import com.bumptech.glide.Glide
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AnnouncementResponse
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.util.UploadMediaOptimizer
import xyz.yenkasa.app.util.UploadProgressRequestBody
import java.io.File
import java.io.IOException
import java.net.SocketTimeoutException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import kotlin.math.roundToInt
import org.json.JSONObject

class YenkasaUpdateComposerActivity : AppCompatActivity() {

    private data class ComposerMediaItem(
        val uri: Uri,
        val type: String,
        val displayName: String,
        val sizeBytes: Long
    )

    private enum class SubmissionMode {
        DRAFT,
        SEND
    }

    private lateinit var inputTitle: TextInputEditText
    private lateinit var inputBody: TextInputEditText
    private lateinit var inputLink: TextInputEditText
    private lateinit var inputAudience: AutoCompleteTextView
    private lateinit var inputCommunity: AutoCompleteTextView
    private lateinit var layoutCommunity: TextInputLayout
    private lateinit var switchPinned: SwitchCompat
    private lateinit var switchSchedule: SwitchCompat
    private lateinit var buttonSchedule: Button
    private lateinit var buttonPreview: Button
    private lateinit var buttonSaveDraft: Button
    private lateinit var buttonSend: Button
    private lateinit var mediaListLayout: LinearLayout
    private lateinit var mediaCountText: TextView
    private lateinit var uploadStatusPill: View
    private lateinit var uploadStatusIcon: ImageView
    private lateinit var uploadStatusTitle: TextView
    private lateinit var uploadStatusSubtitle: TextView
    private lateinit var uploadStatusPercent: TextView
    private lateinit var uploadStatusProgress: ProgressBar
    private val completionHandler = Handler(Looper.getMainLooper())

    private val selectedMedia = mutableListOf<ComposerMediaItem>()
    private val communityOptions = mutableListOf<Community>()
    private val audienceKeys = listOf("all", "verified", "moderators", "developers", "community")
    private val audienceLabels by lazy {
        listOf(
            getString(R.string.announcement_audience_all_title),
            getString(R.string.announcement_audience_verified_title),
            getString(R.string.announcement_audience_moderators_title),
            getString(R.string.announcement_audience_developers_title),
            getString(R.string.announcement_audience_community_title)
        )
    }
    private var scheduledAt: Calendar? = null
    private var submissionMode: SubmissionMode? = null

    companion object {
        private const val MAX_MEDIA_FILES = 5
        private const val LARGE_VIDEO_HINT_BYTES = 25L * 1024L * 1024L
    }

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { addMedia(it, "image") }
    }
    private val pickVideoLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { addMedia(it, "video") }
    }
    private val pickAudioLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { addMedia(it, "audio") }
    }
    private val pickFileLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri?.let { addMedia(it, "file") }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        setContentView(R.layout.activity_yenkasa_update_composer)

        bindViews()
        configureInputs()
        configureFormattingActions()
        configureAudienceDropdown()
        configureActions()
        updateScheduleUi()
        updateMediaList()
        loadCommunities()
    }

    private fun bindViews() {
        inputTitle = findViewById(R.id.inputUpdateTitle)
        inputBody = findViewById(R.id.inputUpdateBody)
        inputLink = findViewById(R.id.inputUpdateLink)
        inputAudience = findViewById(R.id.inputAnnouncementAudience)
        inputCommunity = findViewById(R.id.inputAnnouncementCommunity)
        layoutCommunity = findViewById(R.id.layoutAnnouncementCommunity)
        switchPinned = findViewById(R.id.switchUpdatePinned)
        switchSchedule = findViewById(R.id.switchAnnouncementSchedule)
        buttonSchedule = findViewById(R.id.buttonAnnouncementSchedule)
        buttonPreview = findViewById(R.id.buttonAnnouncementPreview)
        buttonSaveDraft = findViewById(R.id.buttonSaveDraftAnnouncement)
        buttonSend = findViewById(R.id.buttonPublishUpdate)
        mediaListLayout = findViewById(R.id.layoutAnnouncementMediaList)
        mediaCountText = findViewById(R.id.textAnnouncementMediaCount)
        uploadStatusPill = findViewById(R.id.uploadStatusPill)
        uploadStatusIcon = findViewById(R.id.imageUploadStatusIcon)
        uploadStatusTitle = findViewById(R.id.textUploadStatusTitle)
        uploadStatusSubtitle = findViewById(R.id.textUploadStatusSubtitle)
        uploadStatusPercent = findViewById(R.id.textUploadStatusPercent)
        uploadStatusProgress = findViewById(R.id.progressUploadStatus)
    }

    private fun configureInputs() {
        inputTitle.filters = arrayOf(InputFilter.LengthFilter(100))
        inputBody.filters = arrayOf(InputFilter.LengthFilter(5000))
    }

    private fun configureActions() {
        findViewById<View>(R.id.buttonUpdateBack).setOnClickListener { finish() }
        findViewById<View>(R.id.buttonAddAnnouncementImage).setOnClickListener {
            pickImageLauncher.launch("image/*")
        }
        findViewById<View>(R.id.buttonAddAnnouncementVideo).setOnClickListener {
            pickVideoLauncher.launch("video/*")
        }
        findViewById<View>(R.id.buttonAddAnnouncementAudio).setOnClickListener {
            pickAudioLauncher.launch("audio/*")
        }
        findViewById<View>(R.id.buttonAddAnnouncementFile).setOnClickListener {
            pickFileLauncher.launch("*/*")
        }
        switchSchedule.setOnCheckedChangeListener { _, _ -> updateScheduleUi() }
        buttonSchedule.setOnClickListener { openSchedulePicker() }
        buttonPreview.setOnClickListener { showPreviewDialog() }
        buttonSaveDraft.setOnClickListener { submitAnnouncement(SubmissionMode.DRAFT) }
        buttonSend.setOnClickListener { submitAnnouncement(SubmissionMode.SEND) }
    }

    private fun configureAudienceDropdown() {
        inputAudience.setAdapter(
            android.widget.ArrayAdapter(
                this,
                android.R.layout.simple_list_item_1,
                audienceLabels
            )
        )
        inputAudience.setText(audienceLabels.first(), false)
        inputAudience.setOnItemClickListener { _, _, position, _ ->
            val key = audienceKeys.getOrNull(position).orEmpty()
            layoutCommunity.visibility = if (key == "community") View.VISIBLE else View.GONE
        }
    }

    private fun configureFormattingActions() {
        findViewById<Button>(R.id.buttonFormatNormal).setOnClickListener {
            inputBody.requestFocus()
        }
        findViewById<Button>(R.id.buttonFormatBold).setOnClickListener {
            wrapBodySelection("<b>", "</b>")
        }
        findViewById<Button>(R.id.buttonFormatItalic).setOnClickListener {
            wrapBodySelection("<i>", "</i>")
        }
        findViewById<Button>(R.id.buttonFormatUnderline).setOnClickListener {
            wrapBodySelection("<u>", "</u>")
        }
        findViewById<Button>(R.id.buttonFormatBullets).setOnClickListener {
            insertIntoBody("\n- ")
        }
        findViewById<Button>(R.id.buttonFormatLink).setOnClickListener {
            insertIntoBody(getString(R.string.announcement_insert_link_placeholder))
            inputLink.requestFocus()
        }
        findViewById<Button>(R.id.buttonFormatEmoji).setOnClickListener {
            insertIntoBody(getString(R.string.announcement_insert_emoji))
        }
    }

    private fun configureSystemBars() {
        val backgroundColor = getColor(R.color.menu_background)
        window.statusBarColor = backgroundColor
        window.navigationBarColor = backgroundColor

        val nightMode = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
        val lightBars = nightMode != Configuration.UI_MODE_NIGHT_YES
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightBars
            isAppearanceLightNavigationBars = lightBars
        }
    }

    private fun loadCommunities() {
        val token = TokenManager.getToken(this) ?: return
        ApiClient.apiService.getCommunities("Bearer $token")
            .enqueue(object : Callback<List<Community>> {
                override fun onResponse(call: Call<List<Community>>, response: Response<List<Community>>) {
                    val communities = response.body().orEmpty()
                        .filter { !it.id.isNullOrBlank() }
                        .sortedBy { it.displayName ?: it.name ?: "" }
                    communityOptions.clear()
                    communityOptions.addAll(communities)
                    val labels = communities.map { it.displayName ?: it.name ?: it.id.orEmpty() }
                    inputCommunity.setAdapter(
                        android.widget.ArrayAdapter(
                            this@YenkasaUpdateComposerActivity,
                            android.R.layout.simple_list_item_1,
                            labels
                        )
                    )
                }

                override fun onFailure(call: Call<List<Community>>, t: Throwable) = Unit
            })
    }

    private fun wrapBodySelection(openTag: String, closeTag: String) {
        val editable = inputBody.text ?: return
        val start = inputBody.selectionStart.coerceAtLeast(0)
        val end = inputBody.selectionEnd.coerceAtLeast(0)
        val min = minOf(start, end)
        val max = maxOf(start, end)
        val selected = editable.substring(min, max)
        editable.replace(min, max, openTag + selected + closeTag)
    }

    private fun insertIntoBody(text: String) {
        val editable = inputBody.text ?: return
        val cursor = inputBody.selectionStart.coerceAtLeast(0)
        editable.insert(cursor, text)
    }

    private fun addMedia(uri: Uri, type: String) {
        if (selectedMedia.size >= MAX_MEDIA_FILES) {
            Toast.makeText(this, R.string.announcement_media_limit_reached, Toast.LENGTH_SHORT).show()
            return
        }

        val metadata = readFileMetadata(uri)
        if (metadata == null) {
            Toast.makeText(this, R.string.announcement_media_pick_failed, Toast.LENGTH_SHORT).show()
            return
        }

        val limitBytes = when (type) {
            "image" -> 10L * 1024L * 1024L
            "video" -> 50L * 1024L * 1024L
            "audio" -> 20L * 1024L * 1024L
            else -> 20L * 1024L * 1024L
        }
        if (metadata.second > limitBytes) {
            val messageRes = when (type) {
                "image" -> R.string.announcement_media_too_large_image
                "video" -> R.string.announcement_media_too_large_video
                "audio" -> R.string.announcement_media_too_large_audio
                else -> R.string.announcement_media_too_large_file
            }
            Toast.makeText(this, messageRes, Toast.LENGTH_LONG).show()
            return
        }

        if (selectedMedia.any { it.uri == uri }) return

        selectedMedia.add(
            ComposerMediaItem(
                uri = uri,
                type = type,
                displayName = metadata.first,
                sizeBytes = metadata.second
            )
        )
        updateMediaList()
    }

    private fun readFileMetadata(uri: Uri): Pair<String, Long>? {
        return contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (!cursor.moveToFirst()) return null
            val name = if (nameIndex >= 0) cursor.getString(nameIndex) else getString(R.string.announcement_attachment)
            val size = if (sizeIndex >= 0) cursor.getLong(sizeIndex) else 0L
            name to size
        }
    }

    private fun updateMediaList() {
        mediaListLayout.removeAllViews()
        selectedMedia.forEachIndexed { index, item ->
            val row = LayoutInflater.from(this)
                .inflate(R.layout.item_announcement_media_entry, mediaListLayout, false)
            val imageThumb = row.findViewById<ImageView>(R.id.imageAnnouncementMediaThumb)
            val textName = row.findViewById<TextView>(R.id.textAnnouncementMediaName)
            val textMeta = row.findViewById<TextView>(R.id.textAnnouncementMediaMeta)
            val removeButton = row.findViewById<ImageButton>(R.id.buttonRemoveAnnouncementMedia)

            textName.text = item.displayName
            textMeta.text = getString(
                R.string.announcement_media_meta,
                when (item.type) {
                    "image" -> getString(R.string.announcement_media_type_image)
                    "video" -> getString(R.string.announcement_media_type_video)
                    "audio" -> getString(R.string.announcement_media_type_audio)
                    else -> getString(R.string.announcement_media_type_file)
                },
                formatBytes(item.sizeBytes)
            )

            when (item.type) {
                "image", "video" -> {
                    Glide.with(imageThumb)
                        .load(item.uri)
                        .centerCrop()
                        .placeholder(R.drawable.placeholder_image)
                        .error(R.drawable.placeholder_image)
                        .into(imageThumb)
                }
                "audio" -> {
                    imageThumb.setImageResource(R.drawable.ic_audio)
                    imageThumb.imageTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.post_create_accent))
                    imageThumb.scaleType = ImageView.ScaleType.CENTER
                }
                else -> {
                    imageThumb.setImageResource(R.drawable.ic_attach_file)
                    imageThumb.imageTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.menu_secondary_text))
                    imageThumb.scaleType = ImageView.ScaleType.CENTER
                }
            }

            removeButton.setOnClickListener {
                selectedMedia.removeAt(index)
                updateMediaList()
            }

            mediaListLayout.addView(row)
        }
        mediaCountText.text = getString(R.string.announcement_media_count, selectedMedia.size)
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes <= 0L) return getString(R.string.announcement_file_size_zero)
        val kb = bytes / 1024.0
        return if (kb >= 1024.0) {
            getString(R.string.announcement_file_size_mb, kb / 1024.0)
        } else {
            getString(R.string.announcement_file_size_kb, kb)
        }
    }

    private fun selectedAudienceKey(): String {
        val label = inputAudience.text?.toString().orEmpty()
        val index = audienceLabels.indexOf(label).coerceAtLeast(0)
        return audienceKeys.getOrElse(index) { "all" }
    }

    private fun selectedCommunity(): Community? {
        val label = inputCommunity.text?.toString().orEmpty()
        return communityOptions.firstOrNull { (it.displayName ?: it.name ?: "") == label }
    }

    private fun updateScheduleUi() {
        buttonSchedule.visibility = if (switchSchedule.isChecked) View.VISIBLE else View.GONE
        buttonSchedule.text = if (switchSchedule.isChecked && scheduledAt != null) {
            val dateLabel = SimpleDateFormat("dd MMM yyyy", Locale.getDefault()).format(scheduledAt!!.time)
            val timeLabel = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(scheduledAt!!.time)
            getString(R.string.announcement_schedule_selected, dateLabel, timeLabel)
        } else {
            getString(R.string.announcement_schedule_pick)
        }
    }

    private fun openSchedulePicker() {
        val calendar = scheduledAt ?: Calendar.getInstance()
        DatePickerDialog(
            this,
            { _, year, month, dayOfMonth ->
                TimePickerDialog(
                    this,
                    { _, hourOfDay, minute ->
                        scheduledAt = Calendar.getInstance().apply {
                            set(Calendar.YEAR, year)
                            set(Calendar.MONTH, month)
                            set(Calendar.DAY_OF_MONTH, dayOfMonth)
                            set(Calendar.HOUR_OF_DAY, hourOfDay)
                            set(Calendar.MINUTE, minute)
                            set(Calendar.SECOND, 0)
                            set(Calendar.MILLISECOND, 0)
                        }
                        updateScheduleUi()
                    },
                    calendar.get(Calendar.HOUR_OF_DAY),
                    calendar.get(Calendar.MINUTE),
                    false
                ).show()
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        ).show()
    }

    private fun showPreviewDialog() {
        val messageView = TextView(this).apply {
            val previewAudience = inputAudience.text?.toString().orEmpty()
            val previewSchedule = if (switchSchedule.isChecked && scheduledAt != null) {
                buttonSchedule.text.toString()
            } else {
                getString(R.string.announcement_schedule_none)
            }
            text = getString(
                R.string.announcement_preview_audience,
                previewAudience
            ) + "\n" +
                getString(R.string.announcement_preview_schedule, previewSchedule) + "\n" +
                getString(R.string.announcement_preview_media_count, selectedMedia.size) + "\n\n"
            append(inputTitle.text?.toString().orEmpty())
            append("\n\n")
            append(HtmlCompat.fromHtml(inputBody.text?.toString().orEmpty(), HtmlCompat.FROM_HTML_MODE_LEGACY))
            movementMethod = LinkMovementMethod.getInstance()
            setPadding(32, 12, 32, 12)
            textSize = 15f
        }

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.announcement_preview_title))
            .setView(messageView)
            .setPositiveButton(R.string.announcement_preview_close, null)
            .show()
    }

    private fun submitAnnouncement(mode: SubmissionMode) {
        val title = inputTitle.text?.toString()?.trim().orEmpty()
        val message = inputBody.text?.toString()?.trim().orEmpty()
        val targetUrl = normalizeLink(inputLink.text?.toString()?.trim().orEmpty())
        val audienceKey = selectedAudienceKey()
        val selectedCommunity = selectedCommunity()
        val scheduledTime = scheduledAt
        val shouldSchedule = mode == SubmissionMode.SEND && switchSchedule.isChecked

        inputTitle.error = null
        inputBody.error = null

        if (title.isBlank()) {
            inputTitle.error = getString(R.string.announcement_title_required)
            inputTitle.requestFocus()
            return
        }
        if (message.isBlank()) {
            inputBody.error = getString(R.string.announcement_message_required)
            inputBody.requestFocus()
            return
        }
        if (audienceKey == "community" && selectedCommunity?.id.isNullOrBlank()) {
            Toast.makeText(this, R.string.announcement_community_required, Toast.LENGTH_SHORT).show()
            return
        }
        if (shouldSchedule && (scheduledTime == null || scheduledTime.timeInMillis <= System.currentTimeMillis())) {
            Toast.makeText(this, R.string.announcement_schedule_future_required, Toast.LENGTH_SHORT).show()
            return
        }

        submissionMode = mode
        setSubmitting(true, mode)

        val status = when {
            mode == SubmissionMode.DRAFT -> "draft"
            shouldSchedule -> "scheduled"
            else -> "published"
        }

        showUploadStatus(
            title = getString(R.string.announcement_upload_preparing),
            subtitle = getString(R.string.announcement_upload_preparing_subtitle),
            progress = 4
        )

        val preparedParts = mutableListOf<Pair<ComposerMediaItem, File>>()
        for (item in selectedMedia) {
            try {
                val file = UploadMediaOptimizer.prepareForUpload(
                    context = this,
                    uri = item.uri,
                    type = item.type,
                    maxImageDimension = 1600,
                    jpegQuality = 82
                ) ?: throw IOException("prepare failed")
                preparedParts.add(item to file)
            } catch (_: Exception) {
                setUploadFailureState(getString(R.string.announcement_media_pick_failed))
                return
            }
        }

        val totalBytes = preparedParts.sumOf { maxOf(it.second.length(), 1L) }
        val hasLargeVideo = preparedParts.any { it.first.type == "video" && it.second.length() >= LARGE_VIDEO_HINT_BYTES }
        val mediaSubtitle = when {
            hasLargeVideo -> getString(R.string.announcement_upload_large_video_hint)
            preparedParts.isEmpty() -> getString(R.string.announcement_upload_text_only)
            else -> getString(R.string.announcement_upload_media_subtitle)
        }

        val scheduledAtIso = if (shouldSchedule && scheduledTime != null) {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).format(scheduledTime.time)
        } else {
            null
        }

        showUploadStatus(
            title = getString(R.string.announcement_upload_in_progress),
            subtitle = mediaSubtitle,
            progress = if (preparedParts.isEmpty()) 20 else 8
        )

        var uploadedOffset = 0L
        val mediaParts = preparedParts.map { (item, file) ->
            val partLength = maxOf(file.length(), 1L)
            val baseOffset = uploadedOffset
            uploadedOffset += partLength
            val requestFile = file.asRequestBody(resolveMimeType(item).toMediaTypeOrNull())
            val wrappedBody = UploadProgressRequestBody(requestFile) { bytesWritten, _ ->
                if (totalBytes <= 0L) return@UploadProgressRequestBody
                val rawPercent = (((baseOffset + bytesWritten).toDouble() / totalBytes.toDouble()) * 100.0)
                    .roundToInt()
                    .coerceIn(0, 100)
                val uiPercent = (8 + ((rawPercent / 100f) * 84f).roundToInt()).coerceIn(8, 92)
                runOnUiThread {
                    showUploadStatus(
                        title = getString(R.string.announcement_upload_in_progress),
                        subtitle = mediaSubtitle,
                        progress = uiPercent
                    )
                }
            }
            MultipartBody.Part.createFormData("media", file.name, wrappedBody)
        }

        ApiClient.uploadApiService.createAnnouncement(
            title = title.toRequestBody("text/plain".toMediaTypeOrNull()),
            message = message.toRequestBody("text/plain".toMediaTypeOrNull()),
            audience = audienceKey.toRequestBody("text/plain".toMediaTypeOrNull()),
            status = status.toRequestBody("text/plain".toMediaTypeOrNull()),
            isPinned = switchPinned.isChecked.toString().toRequestBody("text/plain".toMediaTypeOrNull()),
            communityId = selectedCommunity?.id?.takeIf { audienceKey == "community" }?.toRequestBody("text/plain".toMediaTypeOrNull()),
            communityName = (selectedCommunity?.displayName ?: selectedCommunity?.name)
                ?.takeIf { audienceKey == "community" }
                ?.toRequestBody("text/plain".toMediaTypeOrNull()),
            scheduledAt = scheduledAtIso?.toRequestBody("text/plain".toMediaTypeOrNull()),
            targetUrl = targetUrl.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaTypeOrNull()),
            deepLinkUrl = targetUrl.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaTypeOrNull()),
            media = mediaParts
        ).enqueue(object : Callback<AnnouncementResponse> {
            override fun onResponse(call: Call<AnnouncementResponse>, response: Response<AnnouncementResponse>) {
                setSubmitting(false, mode)
                if (!response.isSuccessful || response.body()?.success != true) {
                    val backendMessage = response.body()?.message?.takeIf { it.isNotBlank() }
                        ?: readBackendError(response)
                    val message = backendMessage.ifBlank { getString(R.string.announcement_publish_failed) }
                    setUploadFailureState(message)
                    Toast.makeText(this@YenkasaUpdateComposerActivity, message, Toast.LENGTH_LONG).show()
                    return
                }

                val successMessage = when (mode) {
                    SubmissionMode.DRAFT -> getString(R.string.announcement_draft_saved)
                    SubmissionMode.SEND -> if (status == "scheduled") {
                        getString(R.string.announcement_scheduled_success)
                    } else {
                        getString(R.string.announcement_publish_success)
                    }
                }
                completeSubmission(successMessage)
            }

            override fun onFailure(call: Call<AnnouncementResponse>, t: Throwable) {
                setSubmitting(false, mode)
                val message = when (t) {
                    is SocketTimeoutException -> getString(R.string.announcement_upload_large_video_hint)
                    is IOException -> getString(R.string.network_error_check_connection)
                    else -> getString(R.string.announcement_publish_failed)
                }
                setUploadFailureState(message)
                Toast.makeText(this@YenkasaUpdateComposerActivity, message, Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun normalizeLink(raw: String): String {
        if (raw.isBlank()) return ""
        return when {
            raw.startsWith("/") -> raw
            raw.startsWith("https://") || raw.startsWith("http://") || raw.startsWith("market://") -> raw
            raw.startsWith("www.yenkasa.xyz/") -> "https://$raw"
            raw.startsWith("yenkasa.xyz/") -> "https://$raw"
            else -> "/${raw.trimStart('/')}"
        }
    }

    private fun resolveMimeType(item: ComposerMediaItem): String {
        return contentResolver.getType(item.uri) ?: when (item.type) {
            "image" -> "image/jpeg"
            "video" -> "video/mp4"
            "audio" -> "audio/m4a"
            else -> "application/octet-stream"
        }
    }

    private fun setSubmitting(submitting: Boolean, mode: SubmissionMode) {
        val enabled = !submitting
        buttonPreview.isEnabled = enabled
        buttonSaveDraft.isEnabled = enabled
        buttonSend.isEnabled = enabled
        inputTitle.isEnabled = enabled
        inputBody.isEnabled = enabled
        inputLink.isEnabled = enabled
        inputAudience.isEnabled = enabled
        inputCommunity.isEnabled = enabled
        switchPinned.isEnabled = enabled
        switchSchedule.isEnabled = enabled
        buttonSchedule.isEnabled = enabled
        setUploadInteractionEnabled(enabled)

        buttonSaveDraft.text = if (submitting && mode == SubmissionMode.DRAFT) {
            getString(R.string.announcement_saving_draft)
        } else {
            getString(R.string.announcement_save_draft)
        }
        buttonSend.text = if (submitting) {
            when {
                mode == SubmissionMode.SEND && switchSchedule.isChecked -> getString(R.string.announcement_scheduling)
                else -> getString(R.string.announcement_sending)
            }
        } else {
            getString(R.string.announcement_send)
        }
    }

    private fun setUploadInteractionEnabled(enabled: Boolean) {
        findViewById<View>(R.id.buttonUpdateBack).isEnabled = enabled
        findViewById<View>(R.id.buttonAddAnnouncementImage).isEnabled = enabled
        findViewById<View>(R.id.buttonAddAnnouncementVideo).isEnabled = enabled
        findViewById<View>(R.id.buttonAddAnnouncementAudio).isEnabled = enabled
        findViewById<View>(R.id.buttonAddAnnouncementFile).isEnabled = enabled
        mediaListLayout.isEnabled = enabled
    }

    private fun showUploadStatus(title: String, subtitle: String, progress: Int, success: Boolean = false) {
        if (uploadStatusPill.visibility != View.VISIBLE) {
            uploadStatusPill.alpha = 0f
            uploadStatusPill.visibility = View.VISIBLE
            uploadStatusPill.animate().alpha(1f).setDuration(180L).start()
        }

        uploadStatusTitle.text = title
        uploadStatusSubtitle.text = subtitle
        uploadStatusProgress.isIndeterminate = false
        uploadStatusProgress.progress = progress
        uploadStatusPercent.text = getString(R.string.announcement_upload_percent, progress)
        uploadStatusProgress.progressTintList = ColorStateList.valueOf(
            ContextCompat.getColor(
                this,
                if (success) R.color.yenkasa_emerald else R.color.yenkasa_amber
            )
        )
        uploadStatusIcon.setImageResource(if (success) R.drawable.ic_check_circle else R.drawable.ic_upload)
        uploadStatusIcon.imageTintList = ColorStateList.valueOf(
            ContextCompat.getColor(
                this,
                if (success) R.color.yenkasa_emerald else R.color.post_create_accent
            )
        )
    }

    private fun setUploadFailureState(message: String) {
        showUploadStatus(
            title = getString(R.string.announcement_upload_failed_title),
            subtitle = message,
            progress = uploadStatusProgress.progress.coerceAtLeast(0),
            success = false
        )
    }

    private fun completeSubmission(message: String) {
        showUploadStatus(
            title = message,
            subtitle = getString(R.string.announcement_upload_success_subtitle),
            progress = 100,
            success = true
        )
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        MediaPlayer.create(applicationContext, R.raw.sound_chime)?.apply {
            setOnCompletionListener { player -> player.release() }
            start()
        }
        completionHandler.removeCallbacksAndMessages(null)
        completionHandler.postDelayed({ finish() }, 900L)
    }

    private fun readBackendError(response: Response<AnnouncementResponse>): String {
        val errorText = try {
            response.errorBody()?.string().orEmpty()
        } catch (_: Exception) {
            ""
        }
        if (errorText.isBlank()) return ""

        return try {
            val json = JSONObject(errorText)
            json.optString("message")
                .ifBlank { json.optString("error") }
                .ifBlank { errorText }
        } catch (_: Exception) {
            errorText
        }
    }
}
