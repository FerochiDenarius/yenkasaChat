package xyz.yenkasa.app.ui.chat

import android.content.Context
import android.database.Cursor
import android.graphics.Typeface
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File
import java.util.ArrayDeque
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMediaItem
import xyz.yenkasa.app.ui.ChatMediaPreviewActivity
import xyz.yenkasa.app.ui.ChatMessageHandler
import xyz.yenkasa.app.ui.ChatPreviewGlideListener
import xyz.yenkasa.app.ui.RichContentEditText

class ChatMediaController(
    private val activity: AppCompatActivity,
    private val chatMessageHandlerProvider: () -> ChatMessageHandler,
    private val openStickerPicker: () -> Unit,
    private val openVisualPicker: (PickVisualMediaRequest) -> Unit,
    private val openCameraCapture: (Uri) -> Unit,
    private val openMediaPreview: (List<ChatMediaItem>) -> Unit,
    private val replyingToMessageIdProvider: () -> String?,
    private val messageInput: RichContentEditText,
    private val sendButton: ImageButton,
    private val micButton: ImageButton,
    private val attachMenu: LinearLayout,
    private val mediaPreviewLayout: View,
    private val imageMediaPreview: ImageView,
    private val textMediaPreviewPlay: TextView,
    private val textMediaPreviewTitle: TextView,
    private val textMediaPreviewSubtitle: TextView
) {
    private var tempCameraUri: Uri? = null
    private var pendingMediaUri: Uri? = null
    private var pendingMediaType: String? = null
    private var isUploadingPendingMedia: Boolean = false
    private val outgoingMediaQueue = ArrayDeque<QueuedMediaUpload>()
    private var isUploadingMediaQueue: Boolean = false

    private data class QueuedMediaUpload(
        val uri: Uri,
        val type: String,
        val caption: String? = null
    )

    suspend fun handlePickedMediaUris(uris: List<Uri>) {
        if (uris.isEmpty()) return
        val items = buildPickedMediaItems(uris)
        if (items.isEmpty()) {
            Toast.makeText(activity, R.string.chat_media_send_empty, Toast.LENGTH_SHORT).show()
            return
        }
        launchChatMediaPreview(items)
    }

    fun handleCameraCaptureResult(success: Boolean) {
        if (success) {
            val imageUri = tempCameraUri
            if (imageUri == null) {
                Toast.makeText(activity, R.string.camera_image_not_saved_try_again, Toast.LENGTH_LONG).show()
            } else {
                Log.d(TAG, "Camera capture ready: $imageUri")
                launchChatMediaPreview(
                    listOf(
                        ChatMediaItem(
                            id = System.currentTimeMillis(),
                            uriString = imageUri.toString(),
                            mimeType = "image/jpeg",
                            displayName = "camera_${System.currentTimeMillis()}.jpg",
                            isVideo = false
                        )
                    )
                )
            }
        } else {
            Toast.makeText(activity, R.string.photo_cancelled, Toast.LENGTH_SHORT).show()
        }
    }

    fun launchCameraCapture() {
        try {
            val photoFile = File.createTempFile("camera_photo_${System.currentTimeMillis()}", ".jpg", activity.cacheDir)
            tempCameraUri = FileProvider.getUriForFile(activity, "${activity.applicationContext.packageName}.provider", photoFile)
            tempCameraUri?.let { openCameraCapture(it) }
        } catch (ex: Exception) {
            Log.e(TAG, "Error starting camera capture", ex)
            Toast.makeText(activity, activity.getString(R.string.could_not_start_camera_with_error, ex.message.orEmpty()), Toast.LENGTH_LONG).show()
        }
    }

    fun launchChatMediaPicker() {
        try {
            openVisualPicker(
                PickVisualMediaRequest(
                    ActivityResultContracts.PickVisualMedia.ImageAndVideo
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "Unable to launch media picker", e)
            Toast.makeText(activity, R.string.chat_media_picker_open_failed, Toast.LENGTH_SHORT).show()
        }
    }

    fun queueSelectedMediaForUpload(selectedItems: List<ChatMediaItem>, caption: String) {
        outgoingMediaQueue.clear()
        selectedItems.forEachIndexed { index, item ->
            Log.d(
                TAG,
                "Queueing media item: uri=${item.uriString}, mime=${item.mimeType}, isVideo=${item.isVideo}, name=${item.displayName}"
            )
            outgoingMediaQueue.add(
                QueuedMediaUpload(
                    uri = Uri.parse(item.uriString),
                    type = if (item.isVideo) "video" else "image",
                    caption = if (index == 0) caption.takeIf { it.isNotBlank() } else null
                )
            )
        }

        if (outgoingMediaQueue.isEmpty()) {
            Toast.makeText(activity, R.string.chat_media_send_empty, Toast.LENGTH_SHORT).show()
            return
        }

        isUploadingMediaQueue = true
        updateComposerActionButtons()
        Toast.makeText(activity, R.string.chat_media_batch_uploading, Toast.LENGTH_SHORT).show()
        uploadNextQueuedMedia()
    }

    fun hasPendingMedia(): Boolean {
        return pendingMediaUri != null && pendingMediaType != null
    }

    fun uploadPendingMedia(caption: String) {
        val uri = pendingMediaUri ?: return
        val type = pendingMediaType ?: return
        if (isUploadingPendingMedia) return

        isUploadingPendingMedia = true
        textMediaPreviewSubtitle.text = activity.getString(R.string.uploading)
        updateComposerActionButtons()

        val extraData = mutableMapOf<String, Any?>()
        if (caption.isNotBlank()) {
            extraData["text"] = caption
        }
        replyingToMessageIdProvider()?.let { repliedToId ->
            extraData["repliedTo"] = repliedToId
        }

        chatMessageHandlerProvider().uploadFileToCloudinary(uri, type, extraData)
    }

    fun clearPendingMediaAfterSentIfNeeded() {
        if (isUploadingPendingMedia) {
            clearPendingMediaPreview()
        }
    }

    fun continueQueuedUploadIfNeeded() {
        if (isUploadingMediaQueue) {
            uploadNextQueuedMedia()
        }
    }

    fun resetFailedOutgoingState() {
        if (isUploadingPendingMedia) {
            isUploadingPendingMedia = false
            updateComposerActionButtons()
            textMediaPreviewSubtitle.text = activity.getString(R.string.chat_media_preview_failed)
        }
        if (isUploadingMediaQueue) {
            isUploadingMediaQueue = false
            outgoingMediaQueue.clear()
            updateComposerActionButtons()
            Toast.makeText(activity, R.string.chat_media_batch_failed, Toast.LENGTH_SHORT).show()
        }
    }

    fun clearPendingMediaPreview() {
        pendingMediaUri = null
        pendingMediaType = null
        isUploadingPendingMedia = false
        imageMediaPreview.setImageDrawable(null)
        mediaPreviewLayout.visibility = View.GONE
        updateComposerActionButtons()
    }

    fun updateComposerActionButtons() {
        val hasText = !messageInput.text.isNullOrBlank()
        val hasPendingMedia = pendingMediaUri != null
        sendButton.visibility = if (hasText || hasPendingMedia) View.VISIBLE else View.GONE
        val disableSend = isUploadingPendingMedia || isUploadingMediaQueue
        sendButton.isEnabled = !disableSend
        sendButton.alpha = if (disableSend) 0.55f else 1f
        micButton.visibility = if (!hasText && !hasPendingMedia) View.VISIBLE else View.GONE
    }

    fun showStickerTray() {
        val stickers = loadSavedStickerUris()
        val bottomSheet = BottomSheetDialog(activity)
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(20))
            setBackgroundColor(ContextCompat.getColor(activity, R.color.feed_surface))
        }

        val header = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val title = TextView(activity).apply {
            text = activity.getString(R.string.stickers)
            textSize = 18f
            setTextColor(ContextCompat.getColor(activity, R.color.feed_primary_text))
            typeface = Typeface.DEFAULT_BOLD
        }

        val subtitle = TextView(activity).apply {
            text = activity.getString(R.string.sticker_tray_hint)
            textSize = 12f
            setTextColor(ContextCompat.getColor(activity, R.color.feed_secondary_text))
        }

        val titleStack = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            addView(title)
            addView(subtitle)
        }

        val closeButton = ImageButton(activity).apply {
            setImageResource(R.drawable.ic_close)
            background = ContextCompat.getDrawable(activity, R.drawable.bg_chat_header_icon_button)
            setColorFilter(ContextCompat.getColor(activity, R.color.yenkasa_emerald))
            setPadding(dp(10), dp(10), dp(10), dp(10))
            setOnClickListener { bottomSheet.dismiss() }
        }

        header.addView(
            titleStack,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        )
        header.addView(closeButton, LinearLayout.LayoutParams(dp(38), dp(38)))

        val recycler = RecyclerView(activity).apply {
            layoutManager = GridLayoutManager(activity, 4)
            overScrollMode = View.OVER_SCROLL_NEVER
            adapter = StickerTrayAdapter(
                stickers = stickers,
                onAddSticker = {
                    bottomSheet.dismiss()
                    openStickerPicker()
                },
                onSendSticker = { uri ->
                    bottomSheet.dismiss()
                    sendSticker(uri)
                },
                onDeleteSticker = { uri ->
                    confirmDeleteSticker(uri) {
                        bottomSheet.dismiss()
                        showStickerTray()
                    }
                }
            )
        }

        root.addView(header)
        root.addView(
            recycler,
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(14)
            }
        )

        bottomSheet.setContentView(root)
        bottomSheet.show()
    }

    fun saveStickerUri(uri: Uri) {
        val stickers = loadSavedStickerUris()
            .map { it.toString() }
            .toMutableList()

        val stickerUri = uri.toString()
        if (!stickers.contains(stickerUri)) {
            stickers.add(0, stickerUri)
        }

        while (stickers.size > MAX_SAVED_STICKERS) {
            stickers.removeAt(stickers.lastIndex)
        }

        saveStickerList(stickers)
    }

    private fun sendSticker(uri: Uri) {
        chatMessageHandlerProvider().uploadFileToCloudinary(uri, "image")
    }

    private fun launchChatMediaPreview(items: List<ChatMediaItem>) {
        clearPendingMediaPreview()
        openMediaPreview(items)
    }

    private suspend fun buildPickedMediaItems(uris: List<Uri>): List<ChatMediaItem> {
        return withContext(Dispatchers.IO) {
            uris.mapIndexedNotNull { index, uri ->
                try {
                    val mimeType = activity.contentResolver.getType(uri).orEmpty()
                    ChatMediaItem(
                        id = System.currentTimeMillis() + index,
                        uriString = uri.toString(),
                        mimeType = mimeType,
                        displayName = queryDisplayName(uri) ?: "media_${index + 1}",
                        isVideo = mimeType.startsWith("video/")
                    )
                } catch (e: Exception) {
                    Log.w(TAG, "Skipping picked media URI: $uri", e)
                    null
                }
            }
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        var cursor: Cursor? = null
        return try {
            cursor = activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) cursor.getString(nameIndex) else null
            } else {
                null
            }
        } catch (e: Exception) {
            Log.w(TAG, "Unable to resolve media name for $uri", e)
            null
        } finally {
            cursor?.close()
        }
    }

    private fun uploadNextQueuedMedia() {
        val next = if (outgoingMediaQueue.isEmpty()) null else outgoingMediaQueue.removeFirst()
        if (next == null) {
            isUploadingMediaQueue = false
            updateComposerActionButtons()
            Toast.makeText(activity, R.string.chat_media_batch_complete, Toast.LENGTH_SHORT).show()
            return
        }

        val extraData = mutableMapOf<String, Any?>()
        next.caption?.let { extraData["text"] = it }
        replyingToMessageIdProvider()?.let { extraData["repliedTo"] = it }
        Log.d(TAG, "Uploading queued media: uri=${next.uri}, type=${next.type}, caption=${next.caption}")
        chatMessageHandlerProvider().uploadFileToCloudinary(next.uri, next.type, extraData)
    }

    fun showPendingMediaPreview(uri: Uri, type: String) {
        pendingMediaUri = uri
        pendingMediaType = type
        isUploadingPendingMedia = false

        mediaPreviewLayout.visibility = View.VISIBLE
        textMediaPreviewTitle.text = activity.getString(if (type == "video") R.string.chat_media_video_ready else R.string.chat_media_photo_ready)
        textMediaPreviewSubtitle.text = activity.getString(R.string.chat_media_tap_send_when_ready)
        textMediaPreviewPlay.visibility = if (type == "video") View.VISIBLE else View.GONE
        Glide.with(imageMediaPreview)
            .load(uri)
            .centerCrop()
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .listener(
                ChatPreviewGlideListener(
                    onSuccess = {
                        Log.d(TAG, "Composer preview loaded: $uri")
                    },
                    onFailure = {
                        Log.w(TAG, "Composer preview failed: $uri")
                        textMediaPreviewSubtitle.text = activity.getString(R.string.chat_media_preview_failed)
                    }
                )
            )
            .into(imageMediaPreview)

        attachMenu.visibility = View.GONE
        updateComposerActionButtons()
    }

    private fun removeStickerUri(uri: Uri) {
        val stickerUri = uri.toString()
        val stickers = loadSavedStickerUris()
            .map { it.toString() }
            .filterNot { it == stickerUri }

        saveStickerList(stickers)
    }

    private fun saveStickerList(stickers: List<String>) {
        val json = JSONArray()
        stickers.forEach { json.put(it) }
        activity.getSharedPreferences(STICKER_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SAVED_STICKERS, json.toString())
            .apply()
    }

    private fun confirmDeleteSticker(uri: Uri, onDeleted: () -> Unit) {
        AlertDialog.Builder(activity)
            .setTitle(R.string.delete_sticker_title)
            .setMessage(R.string.delete_sticker_message)
            .setPositiveButton(R.string.delete) { dialog, _ ->
                removeStickerUri(uri)
                dialog.dismiss()
                onDeleted()
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun loadSavedStickerUris(): List<Uri> {
        val raw = activity.getSharedPreferences(STICKER_PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SAVED_STICKERS, null)
            ?: return emptyList()

        return runCatching {
            val json = JSONArray(raw)
            buildList {
                for (index in 0 until json.length()) {
                    json.optString(index)
                        .takeIf { it.isNotBlank() }
                        ?.let { add(Uri.parse(it)) }
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun dp(value: Int): Int {
        return (value * activity.resources.displayMetrics.density).toInt()
    }

    private inner class StickerTrayAdapter(
        private val stickers: List<Uri>,
        private val onAddSticker: () -> Unit,
        private val onSendSticker: (Uri) -> Unit,
        private val onDeleteSticker: (Uri) -> Unit
    ) : RecyclerView.Adapter<StickerTrayAdapter.StickerViewHolder>() {

        override fun getItemCount(): Int = stickers.size + 1

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StickerViewHolder {
            val frame = FrameLayout(parent.context).apply {
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dp(82)
                ).apply {
                    setMargins(dp(4), dp(4), dp(4), dp(4))
                }
            }

            val image = ImageView(parent.context).apply {
                id = View.generateViewId()
                scaleType = ImageView.ScaleType.CENTER_CROP
                background = ContextCompat.getDrawable(parent.context, R.drawable.bg_chat_header_icon_button)
                setPadding(dp(10), dp(10), dp(10), dp(10))
            }

            frame.addView(
                image,
                FrameLayout.LayoutParams(dp(72), dp(72), Gravity.CENTER)
            )
            return StickerViewHolder(frame, image)
        }

        override fun onBindViewHolder(holder: StickerViewHolder, position: Int) {
            if (position == 0) {
                holder.image.setImageResource(R.drawable.ic_add)
                holder.image.setColorFilter(ContextCompat.getColor(activity, R.color.yenkasa_emerald))
                holder.itemView.setOnClickListener { onAddSticker() }
                holder.itemView.setOnLongClickListener(null)
                return
            }

            val stickerUri = stickers[position - 1]
            holder.image.clearColorFilter()
            Glide.with(holder.image)
                .load(stickerUri)
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.error_image)
                .into(holder.image)

            holder.itemView.setOnClickListener { onSendSticker(stickerUri) }
            holder.itemView.setOnLongClickListener {
                onDeleteSticker(stickerUri)
                true
            }
        }

        inner class StickerViewHolder(
            itemView: View,
            val image: ImageView
        ) : RecyclerView.ViewHolder(itemView)
    }

    private companion object {
        const val TAG = "ChatMediaController"
        const val STICKER_PREFS = "chat_stickers"
        const val KEY_SAVED_STICKERS = "saved_sticker_uris"
        const val MAX_SAVED_STICKERS = 36
    }
}
