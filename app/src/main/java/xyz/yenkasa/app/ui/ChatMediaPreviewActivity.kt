package xyz.yenkasa.app.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.EditText
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.SelectedMediaAdapter
import xyz.yenkasa.app.model.ChatMediaItem

class ChatMediaPreviewActivity : AppCompatActivity() {

    private lateinit var previewImage: ImageView
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

    private val selectedAdapter = SelectedMediaAdapter(::selectIndex, ::removeItem)
    private val mediaItems = mutableListOf<ChatMediaItem>()
    private var selectedIndex: Int = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_media_preview)

        previewImage = findViewById(R.id.imagePreviewLarge)
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
        findViewById<ImageButton>(R.id.buttonPreviewCrop).setOnClickListener {
            Toast.makeText(this, R.string.chat_media_crop_todo, Toast.LENGTH_SHORT).show()
        }
        findViewById<ImageButton>(R.id.buttonPreviewDraw).setOnClickListener {
            Toast.makeText(this, R.string.chat_media_draw_todo, Toast.LENGTH_SHORT).show()
        }
        findViewById<ImageButton>(R.id.buttonPreviewText).setOnClickListener {
            captionInput.requestFocus()
        }
        findViewById<ImageButton>(R.id.buttonPreviewSticker).setOnClickListener {
            Toast.makeText(this, R.string.chat_media_sticker_todo, Toast.LENGTH_SHORT).show()
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

    private fun updatePreview() {
        selectedAdapter.submitList(mediaItems.toList(), selectedIndex)
        selectedCountText.text = resources.getQuantityString(
            R.plurals.chat_media_selected_count,
            mediaItems.size,
            mediaItems.size
        )

        val item = mediaItems[selectedIndex]
        val uri = Uri.parse(item.uriString)
        playOverlay.isVisible = item.isVideo
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

    companion object {
        const val EXTRA_MEDIA_ITEMS = "chat_media_items"
        const val EXTRA_INITIAL_INDEX = "chat_media_initial_index"
        const val EXTRA_CAPTION = "chat_media_caption"
    }
}
