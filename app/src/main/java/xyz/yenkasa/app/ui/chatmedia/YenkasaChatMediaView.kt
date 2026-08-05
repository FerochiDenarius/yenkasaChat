package xyz.yenkasa.app.ui.chatmedia

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.AttributeSet
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import xyz.yenkasa.app.R
import xyz.yenkasa.app.ui.FilePreviewActivity
import xyz.yenkasa.app.ui.ImagePreviewActivity
import xyz.yenkasa.app.util.R2Media
import java.util.Locale

class YenkasaChatMediaView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    enum class MediaKind { NONE, IMAGE, VIDEO, PDF, DOCX, FILE }

    data class MediaPayload(
        val url: String?,
        val kind: MediaKind,
        val fileName: String? = null,
        val mimeType: String? = null
    )

    private val imageView: ImageView
    private val playerView: PlayerView
    private val playOverlay: ImageView
    private val progress: ProgressBar
    private val errorText: TextView
    private val fileLayout: LinearLayout
    private val fileIcon: TextView
    private val fileNameView: TextView

    private var boundPayload: MediaPayload = MediaPayload(null, MediaKind.NONE)
    private var player: ExoPlayer? = null

    init {
        LayoutInflater.from(context).inflate(R.layout.view_yenkasa_chat_media, this, true)
        imageView = findViewById(R.id.imageChatMedia)
        playerView = findViewById(R.id.playerChatMedia)
        playOverlay = findViewById(R.id.imageChatMediaPlay)
        progress = findViewById(R.id.progressChatMedia)
        errorText = findViewById(R.id.textChatMediaError)
        fileLayout = findViewById(R.id.layoutChatFile)
        fileIcon = findViewById(R.id.textChatFileIcon)
        fileNameView = findViewById(R.id.textChatFileName)

        playerView.useController = true
        isVisible = false
    }

    fun bind(payload: MediaPayload) {
        release()
        boundPayload = payload
        resetViews()

        val url = payload.url?.takeIf { it.isNotBlank() }
        if (url == null || payload.kind == MediaKind.NONE) {
            isVisible = false
            return
        }

        isVisible = true
        when (payload.kind) {
            MediaKind.IMAGE -> bindImage(url)
            MediaKind.VIDEO -> bindVideo(url)
            MediaKind.PDF, MediaKind.DOCX, MediaKind.FILE -> bindFile(url, payload)
            MediaKind.NONE -> isVisible = false
        }
    }

    fun release() {
        if (activeView === this) {
            activeView = null
        }
        playerView.player = null
        player?.release()
        player = null
    }

    private fun resetViews() {
        Glide.with(this).clear(imageView)
        imageView.setImageDrawable(null)
        imageView.isVisible = false
        playerView.isVisible = false
        playOverlay.isVisible = false
        progress.isVisible = false
        errorText.isVisible = false
        fileLayout.isVisible = false
        setOnClickListener(null)
        playOverlay.setOnClickListener(null)
    }

    private fun bindImage(url: String) {
        val imageUrl = R2Media.optimizedImageUrl(url, R2Media.WIDTH_PREVIEW) ?: url
        imageView.isVisible = true
        progress.isVisible = true
        Glide.with(this)
            .load(imageUrl)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .into(imageView)
        progress.isVisible = false
        setOnClickListener {
            context.startActivity(Intent(context, ImagePreviewActivity::class.java).apply {
                putExtra("imageUrl", imageUrl)
            })
        }
    }

    private fun bindVideo(url: String) {
        val videoUrl = R2Media.optimizedVideoUrl(url) ?: url
        imageView.isVisible = true
        playOverlay.isVisible = true
        progress.isVisible = true
        Glide.with(this)
            .asBitmap()
            .load(R.drawable.video_placeholder)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .placeholder(R.drawable.video_placeholder)
            .error(R.drawable.video_placeholder)
            .into(imageView)
        progress.isVisible = false

        val click = OnClickListener { startOrToggleVideo(videoUrl) }
        setOnClickListener(click)
        playOverlay.setOnClickListener(click)
    }

    private fun startOrToggleVideo(url: String) {
        if (activeView === this && player?.isPlaying == true) {
            player?.pause()
            playOverlay.isVisible = true
            return
        }

        pauseActiveVideo()
        activeView = this
        imageView.isVisible = false
        playOverlay.isVisible = false
        playerView.isVisible = true
        progress.isVisible = true

        if (player == null) {
            player = ExoPlayer.Builder(context).build().also { exo ->
                exo.setMediaItem(MediaItem.fromUri(Uri.parse(url)))
                exo.repeatMode = Player.REPEAT_MODE_OFF
                exo.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        progress.isVisible = playbackState == Player.STATE_BUFFERING
                        if (playbackState == Player.STATE_ENDED) {
                            restoreVideoThumb()
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e("YenkasaChatMedia", "Video playback failed: $url", error)
                        errorText.text = context.getString(R.string.video_failed_tap_retry)
                        errorText.isVisible = true
                        restoreVideoThumb()
                    }
                })
                playerView.player = exo
                exo.prepare()
            }
        } else {
            playerView.player = player
        }
        player?.play()
    }

    private fun bindFile(url: String, payload: MediaPayload) {
        val name = payload.fileName?.takeIf { it.isNotBlank() }
            ?: url.substringAfterLast('/').substringBefore('?').ifBlank { context.getString(R.string.document) }
        fileLayout.isVisible = true
        fileNameView.text = name
        fileIcon.text = when (payload.kind) {
            MediaKind.PDF -> "PDF"
            MediaKind.DOCX -> "DOC"
            else -> "FILE"
        }
        setOnClickListener {
            context.startActivity(Intent(context, FilePreviewActivity::class.java).apply {
                putExtra(FilePreviewActivity.EXTRA_FILE_URL, url)
                putExtra(FilePreviewActivity.EXTRA_FILE_NAME, name)
                putExtra(FilePreviewActivity.EXTRA_MIME_TYPE, payload.mimeType.orEmpty())
            })
        }
    }

    private fun restoreVideoThumb() {
        player?.pause()
        playerView.isVisible = false
        imageView.isVisible = true
        playOverlay.isVisible = true
        progress.isVisible = false
    }

    companion object {
        private var activeView: YenkasaChatMediaView? = null

        fun pauseActiveVideo() {
            activeView?.restoreVideoThumb()
        }

        fun releaseActiveVideo() {
            activeView?.release()
            activeView = null
        }

        fun inferPayload(imageUrl: String?, videoUrl: String?, fileUrl: String?): MediaPayload {
            videoUrl?.takeIf { it.isNotBlank() }?.let {
                return MediaPayload(it, MediaKind.VIDEO)
            }
            imageUrl?.takeIf { it.isNotBlank() }?.let {
                return MediaPayload(it, MediaKind.IMAGE)
            }
            val file = fileUrl?.takeIf { it.isNotBlank() } ?: return MediaPayload(null, MediaKind.NONE)
            val cleanName = file.substringAfterLast('/').substringBefore('?')
            val normalized = file.lowercase(Locale.getDefault()).substringBefore('?')
            return when {
                isImageUrl(normalized) -> MediaPayload(file, MediaKind.IMAGE)
                isVideoUrl(normalized) -> MediaPayload(file, MediaKind.VIDEO)
                normalized.endsWith(".pdf") -> MediaPayload(file, MediaKind.PDF, cleanName, "application/pdf")
                normalized.endsWith(".docx") || normalized.endsWith(".doc") ->
                    MediaPayload(file, MediaKind.DOCX, cleanName, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                else -> MediaPayload(file, MediaKind.FILE, cleanName)
            }
        }

        private fun isImageUrl(value: String): Boolean {
            return value.endsWith(".jpg") ||
                value.endsWith(".jpeg") ||
                value.endsWith(".png") ||
                value.endsWith(".webp") ||
                value.endsWith(".gif") ||
                value.contains("/image/upload/")
        }

        private fun isVideoUrl(value: String): Boolean {
            return value.endsWith(".mp4") ||
                value.endsWith(".mov") ||
                value.endsWith(".m4v") ||
                value.endsWith(".webm") ||
                value.contains("/video/upload/")
        }
    }
}
