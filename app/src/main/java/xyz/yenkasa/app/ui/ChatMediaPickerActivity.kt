package xyz.yenkasa.app.ui

import android.Manifest
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.util.Log
import android.view.View
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import xyz.yenkasa.app.R
import xyz.yenkasa.app.adapter.MediaPickerAdapter
import xyz.yenkasa.app.adapter.SelectedMediaAdapter
import xyz.yenkasa.app.model.ChatMediaItem
import java.io.File

class ChatMediaPickerActivity : AppCompatActivity() {

    private lateinit var mediaRecycler: RecyclerView
    private lateinit var selectedRecycler: RecyclerView
    private lateinit var textSelectedCount: TextView
    private lateinit var emptyState: TextView
    private lateinit var loadingView: TextView
    private lateinit var nextButton: ImageButton
    private lateinit var tabAll: TextView
    private lateinit var tabPhotos: TextView
    private lateinit var tabVideos: TextView

    private val mediaAdapter = MediaPickerAdapter(::onMediaItemClicked)
    private val selectedAdapter = SelectedMediaAdapter(::onSelectedTrayClicked, ::removeSelectedItem)
    private val allItems = mutableListOf<ChatMediaItem>()
    private val selectedItems = mutableListOf<ChatMediaItem>()
    private var currentFilter: MediaFilter = MediaFilter.ALL
    private var pendingCameraUri: Uri? = null
    private var pendingPermissionAction: (() -> Unit)? = null

    private enum class MediaFilter { ALL, PHOTOS, VIDEOS }

    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        val action = pendingPermissionAction
        pendingPermissionAction = null
        if (action != null && result.values.any { it }) {
            action.invoke()
        } else if (result.values.any { it }) {
            loadMedia()
        } else {
            showEmptyState(getString(R.string.chat_media_permission_denied))
        }
    }

    private val cameraLauncher = registerForActivityResult(ActivityResultContracts.TakePicture()) { success ->
        val capturedUri = pendingCameraUri
        if (!success || capturedUri == null) {
            Toast.makeText(this, R.string.chat_media_camera_cancelled, Toast.LENGTH_SHORT).show()
            return@registerForActivityResult
        }

        val capturedItem = ChatMediaItem(
            id = System.currentTimeMillis(),
            uriString = capturedUri.toString(),
            mimeType = "image/jpeg",
            displayName = "Camera photo",
            isVideo = false
        )
        openPreview(listOf(capturedItem))
    }

    private val previewLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == RESULT_OK) {
            setResult(RESULT_OK, result.data)
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_chat_media_picker)

        mediaRecycler = findViewById(R.id.recyclerMediaPicker)
        selectedRecycler = findViewById(R.id.recyclerSelectedMedia)
        textSelectedCount = findViewById(R.id.textSelectedCount)
        emptyState = findViewById(R.id.textPickerEmptyState)
        loadingView = findViewById(R.id.viewPickerLoading)
        nextButton = findViewById(R.id.buttonPickerNext)
        tabAll = findViewById(R.id.tabAll)
        tabPhotos = findViewById(R.id.tabPhotos)
        tabVideos = findViewById(R.id.tabVideos)

        mediaRecycler.layoutManager = GridLayoutManager(this, 3)
        mediaRecycler.adapter = mediaAdapter

        selectedRecycler.layoutManager = LinearLayoutManager(this, RecyclerView.HORIZONTAL, false)
        selectedRecycler.adapter = selectedAdapter

        findViewById<ImageButton>(R.id.buttonPickerClose).setOnClickListener { finish() }
        nextButton.setOnClickListener {
            if (selectedItems.isEmpty()) {
                Toast.makeText(this, R.string.chat_media_select_prompt, Toast.LENGTH_SHORT).show()
            } else {
                openPreview(selectedItems.toList())
            }
        }

        tabAll.setOnClickListener { updateFilter(MediaFilter.ALL) }
        tabPhotos.setOnClickListener { updateFilter(MediaFilter.PHOTOS) }
        tabVideos.setOnClickListener { updateFilter(MediaFilter.VIDEOS) }

        updateTabState()
        updateSelectionUi()
        ensureMediaPermissionsAndLoad()
    }

    private fun ensureMediaPermissionsAndLoad() {
        val permissions = requiredMediaPermissions()
        if (permissions.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) {
            loadMedia()
        } else {
            pendingPermissionAction = { loadMedia() }
            permissionsLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun requiredMediaPermissions(): List<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            listOf(Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VIDEO)
        } else {
            listOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    private fun loadMedia() {
        loadingView.visibility = View.VISIBLE
        emptyState.visibility = View.GONE

        lifecycleScope.launch {
            val items = withContext(Dispatchers.IO) { queryRecentMedia() }
            allItems.clear()
            allItems.add(
                ChatMediaItem(
                    id = -1L,
                    uriString = "camera://shortcut",
                    mimeType = "camera/shortcut",
                    displayName = getString(R.string.chat_media_camera),
                    isVideo = false,
                    isCameraShortcut = true
                )
            )
            allItems.addAll(items)
            loadingView.visibility = View.GONE
            if (items.isEmpty()) {
                showEmptyState(getString(R.string.chat_media_empty))
            } else {
                emptyState.visibility = View.GONE
                applyFilter()
            }
        }
    }

    private fun queryRecentMedia(): List<ChatMediaItem> {
        val collection = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            MediaStore.Files.getContentUri(MediaStore.VOLUME_EXTERNAL)
        } else {
            MediaStore.Files.getContentUri("external")
        }

        val projection = arrayOf(
            MediaStore.Files.FileColumns._ID,
            MediaStore.Files.FileColumns.MEDIA_TYPE,
            MediaStore.Files.FileColumns.MIME_TYPE,
            MediaStore.Files.FileColumns.DISPLAY_NAME,
            MediaStore.Files.FileColumns.DATE_ADDED,
            MediaStore.Video.Media.DURATION
        )

        val selection = "${MediaStore.Files.FileColumns.MEDIA_TYPE}=? OR ${MediaStore.Files.FileColumns.MEDIA_TYPE}=?"
        val selectionArgs = arrayOf(
            MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE.toString(),
            MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO.toString()
        )
        val sortOrder = "${MediaStore.Files.FileColumns.DATE_ADDED} DESC LIMIT 120"

        val items = mutableListOf<ChatMediaItem>()
        contentResolver.query(collection, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
            val idIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID)
            val typeIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MEDIA_TYPE)
            val mimeIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE)
            val nameIndex = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME)
            val durationIndex = cursor.getColumnIndexOrThrow(MediaStore.Video.Media.DURATION)

            while (cursor.moveToNext()) {
                val id = cursor.getLong(idIndex)
                val mediaType = cursor.getInt(typeIndex)
                val isVideo = mediaType == MediaStore.Files.FileColumns.MEDIA_TYPE_VIDEO
                val contentUri = if (isVideo) {
                    ContentUris.withAppendedId(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, id)
                } else {
                    ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
                }

                items.add(
                    ChatMediaItem(
                        id = id,
                        uriString = contentUri.toString(),
                        mimeType = cursor.getString(mimeIndex).orEmpty(),
                        displayName = cursor.getString(nameIndex).orEmpty(),
                        isVideo = isVideo,
                        durationMillis = if (isVideo) cursor.getLong(durationIndex) else 0L
                    )
                )
            }
        }
        return items
    }

    private fun applyFilter() {
        val filtered = allItems.filter { item ->
            when {
                item.isCameraShortcut -> true
                currentFilter == MediaFilter.ALL -> true
                currentFilter == MediaFilter.PHOTOS -> !item.isVideo
                else -> item.isVideo
            }
        }
        mediaAdapter.submitList(filtered)
        mediaAdapter.updateSelection(selectedItems)
        emptyState.visibility = if (filtered.size <= 1) View.VISIBLE else View.GONE
        if (filtered.size <= 1) {
            emptyState.text = getString(R.string.chat_media_empty)
        }
    }

    private fun onMediaItemClicked(item: ChatMediaItem) {
        if (item.isCameraShortcut) {
            launchCamera()
            return
        }

        val existingIndex = selectedItems.indexOfFirst { it.uriString == item.uriString }
        if (existingIndex >= 0) {
            selectedItems.removeAt(existingIndex)
        } else {
            if (selectedItems.size >= MAX_SELECTION_COUNT) {
                Toast.makeText(this, getString(R.string.chat_media_limit, MAX_SELECTION_COUNT), Toast.LENGTH_SHORT).show()
                return
            }
            selectedItems.add(item)
        }
        updateSelectionUi()
    }

    private fun onSelectedTrayClicked(index: Int) {
        if (selectedItems.isEmpty()) return
        openPreview(selectedItems.toList(), index)
    }

    private fun removeSelectedItem(item: ChatMediaItem) {
        selectedItems.removeAll { it.uriString == item.uriString }
        updateSelectionUi()
    }

    private fun updateSelectionUi() {
        textSelectedCount.text = resources.getQuantityString(
            R.plurals.chat_media_selected_count,
            selectedItems.size,
            selectedItems.size
        )
        nextButton.alpha = if (selectedItems.isEmpty()) 0.5f else 1f
        nextButton.isEnabled = selectedItems.isNotEmpty()
        selectedRecycler.visibility = if (selectedItems.isEmpty()) View.GONE else View.VISIBLE
        selectedAdapter.submitList(selectedItems.toList())
        mediaAdapter.updateSelection(selectedItems)
    }

    private fun updateFilter(filter: MediaFilter) {
        currentFilter = filter
        updateTabState()
        applyFilter()
    }

    private fun updateTabState() {
        val selectedBg = R.drawable.bg_chat_media_tab_selected
        val unselectedBg = R.drawable.bg_chat_media_tab_unselected
        tabAll.setBackgroundResource(if (currentFilter == MediaFilter.ALL) selectedBg else unselectedBg)
        tabPhotos.setBackgroundResource(if (currentFilter == MediaFilter.PHOTOS) selectedBg else unselectedBg)
        tabVideos.setBackgroundResource(if (currentFilter == MediaFilter.VIDEOS) selectedBg else unselectedBg)
    }

    private fun openPreview(items: List<ChatMediaItem>, initialIndex: Int = 0) {
        val intent = Intent(this, ChatMediaPreviewActivity::class.java).apply {
            putExtra(ChatMediaPreviewActivity.EXTRA_MEDIA_ITEMS, ArrayList(items))
            putExtra(ChatMediaPreviewActivity.EXTRA_INITIAL_INDEX, initialIndex)
        }
        previewLauncher.launch(intent)
    }

    private fun launchCamera() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            pendingPermissionAction = { launchCamera() }
            permissionsLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            return
        }

        try {
            val photoFile = File.createTempFile("chat_capture_${System.currentTimeMillis()}", ".jpg", cacheDir)
            pendingCameraUri = FileProvider.getUriForFile(this, "${applicationContext.packageName}.provider", photoFile)
            cameraLauncher.launch(pendingCameraUri)
        } catch (e: Exception) {
            Log.e("ChatMediaPicker", "Camera launch failed", e)
            Toast.makeText(this, R.string.chat_media_camera_failed, Toast.LENGTH_SHORT).show()
        }
    }

    private fun showEmptyState(message: String) {
        loadingView.visibility = View.GONE
        emptyState.visibility = View.VISIBLE
        emptyState.text = message
    }

    companion object {
        const val MAX_SELECTION_COUNT = 5
    }
}
