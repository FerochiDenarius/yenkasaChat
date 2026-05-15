package xyz.yenkasa.app.ui

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.yalantis.ucrop.UCrop
import java.io.File
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.SelectedMediaAdapter
import xyz.yenkasa.app.model.ChatMediaItem
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView

class ChatMediaPreviewActivity : AppCompatActivity() {

    private lateinit var previewImage: ImageView
    private lateinit var previewVideoView: YenkasaVideoPlayerView
    private lateinit var playOverlay: ImageView
    private lateinit var captionInput: EditText
    private lateinit var selectedCountText: TextView
    private lateinit var loadingText: TextView
    private lateinit var thumbsRecycler: RecyclerView
    private lateinit var filterNone: TextView
    private lateinit var filterVivid: TextView
    private lateinit var filterCool: TextView
    private lateinit var filterWarm: TextView
    private lateinit var filterBw: TextView
    private lateinit var cropButton: ImageButton
    private lateinit var drawButton: ImageButton
    private lateinit var textButton: ImageButton
    private lateinit var stickerButton: ImageButton
    private lateinit var muteButton: ImageButton

    private val selectedAdapter = SelectedMediaAdapter(::selectIndex, ::removeItem)
    private val mediaItems = mutableListOf<ChatMediaItem>()
    private var selectedIndex: Int = 0
    private var previewMuted = true

    private val cropLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != Activity.RESULT_OK) {
            if (result.resultCode != Activity.RESULT_CANCELED) {
                Log.w("ChatMediaPreview", "Crop cancelled or failed: result=${result.resultCode}")
                Toast.makeText(this, R.string.chat_media_crop_failed, Toast.LENGTH_SHORT).show()
            }
            return@registerForActivityResult
        }

        val outputUri = UCrop.getOutput(result.data ?: return@registerForActivityResult)
        if (outputUri == null) {
            Log.w("ChatMediaPreview", "Crop finished without output URI")
            Toast.makeText(this, R.string.chat_media_crop_failed, Toast.LENGTH_SHORT).show()
            return@registerForActivityResult
        }

        Log.d("ChatMediaPreview", "Crop success: $outputUri")
        replaceSelectedMediaUri(outputUri, "image/jpeg")
    }

    private val editorLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        if (result.resultCode != RESULT_OK) {
            if (result.resultCode != RESULT_CANCELED) {
                Log.w("ChatMediaPreview", "Editor cancelled or failed: result=${result.resultCode}")
                Toast.makeText(this, R.string.chat_media_edit_failed, Toast.LENGTH_SHORT).show()
            }
            return@registerForActivityResult
        }

        val outputUri = result.data?.getParcelableExtra<Uri>(ChatMediaEditorActivity.EXTRA_OUTPUT_URI)
        if (outputUri == null) {
            Log.w("ChatMediaPreview", "Editor finished without output URI")
            Toast.makeText(this, R.string.chat_media_edit_failed, Toast.LENGTH_SHORT).show()
            return@registerForActivityResult
        }

        Log.d("ChatMediaPreview", "Editor success: $outputUri")
        replaceSelectedMediaUri(outputUri, "image/jpeg")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_media_preview)

        previewImage = findViewById(R.id.imagePreviewLarge)
        previewVideoView = findViewById(R.id.previewVideoView)
        playOverlay = findViewById(R.id.imagePreviewPlay)
        captionInput = findViewById(R.id.editTextPreviewCaption)
        selectedCountText = findViewById(R.id.textPreviewSelectedCount)
        loadingText = findViewById(R.id.textPreviewLoading)
        thumbsRecycler = findViewById(R.id.recyclerPreviewThumbs)
        filterNone = findViewById(R.id.filterNone)
        filterVivid = findViewById(R.id.filterVivid)
        filterCool = findViewById(R.id.filterCool)
        filterWarm = findViewById(R.id.filterWarm)
        filterBw = findViewById(R.id.filterBw)
        cropButton = findViewById(R.id.buttonPreviewCrop)
        drawButton = findViewById(R.id.buttonPreviewDraw)
        textButton = findViewById(R.id.buttonPreviewText)
        stickerButton = findViewById(R.id.buttonPreviewSticker)
        muteButton = findViewById(R.id.buttonPreviewMute)

        @Suppress("DEPRECATION")
        mediaItems.addAll(
            (intent.getSerializableExtra(EXTRA_MEDIA_ITEMS) as? ArrayList<ChatMediaItem>).orEmpty()
        )
        selectedIndex = intent.getIntExtra(EXTRA_INITIAL_INDEX, 0)
            .coerceIn(0, (mediaItems.size - 1).coerceAtLeast(0))

        if (mediaItems.isEmpty()) {
            finish()
            return
        }

        findViewById<ImageButton>(R.id.buttonPreviewClose).setOnClickListener { finish() }
        findViewById<ImageButton>(R.id.buttonPreviewDelete).setOnClickListener {
            mediaItems.getOrNull(selectedIndex)?.let(::removeItem)
        }
        cropButton.setOnClickListener {
            launchCropForSelectedImage()
        }
        drawButton.setOnClickListener {
            launchEditorForSelectedImage()
        }
        textButton.setOnClickListener {
            captionInput.requestFocus()
        }
        stickerButton.setOnClickListener {
            launchEditorForSelectedImage()
        }
        findViewById<ImageButton>(R.id.buttonPreviewSend).setOnClickListener { finishWithResult() }

        thumbsRecycler.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)
        thumbsRecycler.adapter = selectedAdapter

        listOf(filterNone, filterVivid, filterCool, filterWarm, filterBw).forEach { view ->
            view.setOnClickListener { selectFilter(view as TextView) }
        }
        selectFilter(filterNone)
        updatePreview()
    }

    override fun onPause() {
        super.onPause()
        previewVideoView.pause()
    }

    override fun onDestroy() {
        releasePreviewPlayer()
        super.onDestroy()
    }

    private fun updatePreview() {
        releasePreviewPlayer()
        selectedAdapter.submitList(mediaItems.toList(), selectedIndex)
        selectedCountText.text = resources.getQuantityString(
            R.plurals.chat_media_selected_count,
            mediaItems.size,
            mediaItems.size
        )

        val item = mediaItems[selectedIndex]
        val uri = Uri.parse(item.uriString)
        playOverlay.isVisible = item.isVideo
        previewImage.isVisible = true
        previewVideoView.isVisible = false
        setEditingControlsEnabled(!item.isVideo)
        loadingText.isVisible = true
        loadingText.text = getString(if (item.isVideo) R.string.chat_media_loading_video else R.string.chat_media_loading_image)

        Log.d("ChatMediaPreview", "Loading preview for ${item.mimeType}: ${item.uriString}")

        Glide.with(previewImage)
            .load(uri)
            .centerCrop()
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .listener(
                ChatPreviewGlideListener(
                    onSuccess = {
                        loadingText.isVisible = false
                        Log.d("ChatMediaPreview", "Media preview loaded: ${item.uriString}")
                    },
                    onFailure = {
                        loadingText.text = getString(R.string.chat_media_preview_failed)
                        loadingText.isVisible = true
                        Log.w("ChatMediaPreview", "Media preview failed: ${item.uriString}")
                    }
                )
            )
            .into(previewImage)

        val playVideo = {
            if (item.isVideo) {
                startVideoPreview(uri)
            }
        }
        playOverlay.setOnClickListener { playVideo() }
        previewImage.setOnClickListener { playVideo() }
        muteButton.setOnClickListener { togglePreviewMute() }
        if (item.isVideo) {
            startVideoPreview(uri)
        }
    }

    private fun startVideoPreview(uri: Uri) {
        loadingText.isVisible = false
        playOverlay.isVisible = false
        previewImage.isVisible = false
        previewVideoView.isVisible = true
        muteButton.isVisible = true

        releasePreviewPlayer()
        previewVideoView.bindVideo(
            mediaUrl = uri.toString(),
            autoplay = true,
            muted = previewMuted
        )
        renderPreviewMute()
    }

    private fun releasePreviewPlayer() {
        previewVideoView.release()
        muteButton.isVisible = false
    }

    private fun togglePreviewMute() {
        previewMuted = !previewMuted
        previewVideoView.setMuted(previewMuted)
        renderPreviewMute()
    }

    private fun renderPreviewMute() {
        muteButton.setImageResource(if (previewMuted) R.drawable.ic_volume_off else R.drawable.ic_volume_up)
    }

    private fun setEditingControlsEnabled(isImage: Boolean) {
        cropButton.isVisible = isImage
        drawButton.isVisible = isImage
        stickerButton.isVisible = isImage
        filterNone.isVisible = isImage
        filterVivid.isVisible = isImage
        filterCool.isVisible = isImage
        filterWarm.isVisible = isImage
        filterBw.isVisible = isImage
    }

    private fun removeItem(item: ChatMediaItem) {
        val removedIndex = mediaItems.indexOfFirst { it.uriString == item.uriString }
        if (removedIndex < 0) return
        mediaItems.removeAt(removedIndex)
        if (mediaItems.isEmpty()) {
            finish()
            return
        }
        selectedIndex = selectedIndex.coerceAtMost(mediaItems.lastIndex)
        updatePreview()
    }

    private fun selectIndex(index: Int) {
        selectedIndex = index.coerceIn(0, mediaItems.lastIndex)
        updatePreview()
    }

    private fun selectFilter(selected: TextView) {
        listOf(filterNone, filterVivid, filterCool, filterWarm, filterBw).forEach { filter ->
            filter.setBackgroundResource(
                if (filter === selected) R.drawable.bg_chat_media_filter_selected
                else R.drawable.bg_chat_media_filter
            )
        }
    }

    private fun finishWithResult() {
        val result = Intent().apply {
            putExtra(EXTRA_MEDIA_ITEMS, ArrayList(mediaItems))
            putExtra(EXTRA_CAPTION, captionInput.text?.toString().orEmpty())
        }
        setResult(RESULT_OK, result)
        finish()
    }

    private fun launchCropForSelectedImage() {
        val item = mediaItems.getOrNull(selectedIndex) ?: return
        if (item.isVideo) {
            Toast.makeText(this, R.string.chat_media_edit_images_only, Toast.LENGTH_SHORT).show()
            return
        }

        val sourceUri = Uri.parse(item.uriString)
        val destinationUri = createCacheOutputUri("crop")
        Log.d("ChatMediaPreview", "Launching crop: source=$sourceUri output=$destinationUri")

        val options = UCrop.Options().apply {
            setCompressionQuality(92)
            setHideBottomControls(false)
            setFreeStyleCropEnabled(true)
            setToolbarTitle(getString(R.string.chat_media_crop))
        }

        val intent = UCrop.of(sourceUri, destinationUri)
            .withOptions(options)
            .getIntent(this)
        cropLauncher.launch(intent)
    }

    private fun launchEditorForSelectedImage() {
        val item = mediaItems.getOrNull(selectedIndex) ?: return
        if (item.isVideo) {
            Toast.makeText(this, R.string.chat_media_edit_images_only, Toast.LENGTH_SHORT).show()
            return
        }

        val sourceUri = Uri.parse(item.uriString)
        Log.d("ChatMediaPreview", "Launching editor for $sourceUri")
        val intent = Intent(this, ChatMediaEditorActivity::class.java).apply {
            putExtra(ChatMediaEditorActivity.EXTRA_SOURCE_URI, sourceUri.toString())
        }
        editorLauncher.launch(intent)
    }

    private fun replaceSelectedMediaUri(newUri: Uri, mimeType: String) {
        val existing = mediaItems.getOrNull(selectedIndex) ?: return
        val replacement = existing.copy(
            uriString = newUri.toString(),
            mimeType = mimeType,
            displayName = buildEditedDisplayName(existing.displayName)
        )
        mediaItems[selectedIndex] = replacement
        updatePreview()
    }

    private fun buildEditedDisplayName(original: String): String {
        val base = original.substringBeforeLast('.', original)
        return "${base}_edited.jpg"
    }

    private fun createCacheOutputUri(prefix: String): Uri {
        val outputFile = File(cacheDir, "chat_${prefix}_${System.currentTimeMillis()}.jpg")
        return Uri.fromFile(outputFile)
    }

    companion object {
        const val EXTRA_MEDIA_ITEMS = "chat_media_items"
        const val EXTRA_INITIAL_INDEX = "chat_media_initial_index"
        const val EXTRA_CAPTION = "chat_media_caption"
    }
}
