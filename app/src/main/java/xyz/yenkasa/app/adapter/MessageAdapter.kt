package xyz.yenkasa.app.adapter

import android.content.Intent
import android.content.ActivityNotFoundException
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.engine.GlideException
import com.bumptech.glide.request.RequestListener
import com.bumptech.glide.request.target.Target
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.ui.ImagePreviewActivity
import xyz.yenkasa.app.ui.LocationPreviewActivity
import java.text.SimpleDateFormat
import java.util.*


class MessageAdapter(
    private val currentUserId: String,
    private val receiverName: String
)

:
    ListAdapter<ChatMessage, RecyclerView.ViewHolder>(DiffCallback()) {

    interface OnMessageLongClickListener {
        fun onMessageLongClicked(message: ChatMessage, itemView: View, position: Int): Boolean
    }

    private var longClickListener: OnMessageLongClickListener? = null

    fun setOnMessageLongClickListener(listener: OnMessageLongClickListener) {
        this.longClickListener = listener
    }

    companion object {
        private const val TYPE_SENT = 1
        private const val TYPE_RECEIVED = 2
    }

    override fun getItemViewType(position: Int): Int {
        val message = getItem(position)
        return if (message.senderId == currentUserId) TYPE_SENT else TYPE_RECEIVED
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == TYPE_SENT) {
            val view = inflater.inflate(R.layout.item_message_sent, parent, false)
            SentMessageViewHolder(view)
        } else {
            val view = inflater.inflate(R.layout.item_message_received, parent, false)
            ReceivedMessageViewHolder(view)
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        val message = getItem(position)

        holder.itemView.setOnLongClickListener {
            longClickListener?.onMessageLongClicked(message, it, holder.bindingAdapterPosition)
            true
        }

        when (holder) {
            is SentMessageViewHolder -> holder.bind(message, currentUserId)
            is ReceivedMessageViewHolder -> holder.bind(message, currentUserId)
        }
    }

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        if (holder is BaseMessageViewHolder) {
            holder.recycleMediaState()
        }
        super.onViewRecycled(holder)
    }

    // ------------------------------------------------------------
    // Base ViewHolder
    // ------------------------------------------------------------
    inner abstract class BaseMessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        protected val messageText: TextView = itemView.findViewById(R.id.textMessage)
        protected val timestampText: TextView = itemView.findViewById(R.id.textTimestamp)
        protected val mediaContainer: FrameLayout? = itemView.findViewById(R.id.mediaContainer)
        protected val messageImage: ImageView = itemView.findViewById(R.id.imageMessage)
        protected val videoView: VideoView? = itemView.findViewById(R.id.videoMessage)
        protected val videoPlayOverlay: ImageView? = itemView.findViewById(R.id.imageVideoPlayOverlay)
        protected val mediaFallbackText: TextView? = itemView.findViewById(R.id.textMediaFallback)

        protected val audioContainer: LinearLayout? = itemView.findViewById(R.id.audioContainer)
        protected val btnPlayAudio: ImageButton? = itemView.findViewById(R.id.btnPlayAudio)
        protected val audioSeekBar: SeekBar? = itemView.findViewById(R.id.audioSeekBar)
        protected val audioDuration: TextView? = itemView.findViewById(R.id.audioDuration)

        protected val layoutLocation: LinearLayout? = itemView.findViewById(R.id.layoutLocation)
        protected val textLocation: TextView? = itemView.findViewById(R.id.textLocation)

        protected val layoutFile: LinearLayout? = itemView.findViewById(R.id.layoutFile)
        protected val textFileName: TextView? = itemView.findViewById(R.id.textFileName)

        protected val layoutContact: LinearLayout? = itemView.findViewById(R.id.layoutContact)
        protected val textContactInfo: TextView? = itemView.findViewById(R.id.textContactInfo)

        protected val replyLayout: View? = itemView.findViewById(R.id.replyLayout)
        protected val repliedToName: TextView? = itemView.findViewById(R.id.repliedToName)
        protected val repliedToMessage: TextView? = itemView.findViewById(R.id.repliedToMessage)

        protected var mediaPlayer: MediaPlayer? = null
        protected var handler: Handler? = Handler(Looper.getMainLooper())

        protected val updateSeekBar = object : Runnable {
            override fun run() {
                mediaPlayer?.let { mp ->
                    if (mp.isPlaying) {
                        audioSeekBar?.progress = mp.currentPosition
                        audioDuration?.text = formatTime(mp.currentPosition)
                        handler?.postDelayed(this, 500)
                    }
                }
            }
        }

        open fun bind(message: ChatMessage, currentUserId: String) {
            val context = itemView.context
            resetContentState()
            val effectiveImageUrl = message.imageUrl.takeUnless { it.isNullOrBlank() }
                ?: message.fileUrl.takeIf { it.isLikelyImageUrl() }
            val effectiveVideoUrl = message.videoUrl.takeUnless { it.isNullOrBlank() }
                ?: message.fileUrl.takeIf { it.isLikelyVideoUrl() }
            val effectiveFileUrl = message.fileUrl.takeUnless {
                it.isNullOrBlank() || it == effectiveImageUrl || it == effectiveVideoUrl
            }

            // ---------------- Reply Preview ----------------
            if (message.repliedTo != null && replyLayout != null) {

                val replied = message.repliedTo!!
                replyLayout.visibility = View.VISIBLE

                val senderName =
                    when {
                        replied.senderId == currentUserId -> "You"
                        replied.sender?.username?.isNotBlank() == true -> replied.sender!!.username!!
                        receiverName.isNotBlank() -> receiverName
                        else -> ""
                    }


                repliedToName?.text = senderName

                val replyText = when {
                    !replied.text.isNullOrBlank() -> replied.text!!
                    !replied.imageUrl.isNullOrBlank() -> "📷 Photo"
                    !replied.videoUrl.isNullOrBlank() -> "🎥 Video"
                    !replied.audioUrl.isNullOrBlank() -> "🎵 Audio"
                    !replied.fileUrl.isNullOrBlank() -> "📄 File"
                    replied.location != null -> "📍 Location"
                    !replied.contactInfo.isNullOrBlank() -> "👤 Contact"
                    else -> "(message)"
                }

                repliedToMessage?.apply {
                    text = replyText
                    minWidth = dpToPx(context, 180)
                    maxWidth = dpToPx(context, 260)
                    minLines = 1
                    maxLines = 3
                    ellipsize = TextUtils.TruncateAt.END
                    visibility = View.VISIBLE
                }

            } else {
                replyLayout?.visibility = View.GONE
            }







            // ---------------- Text ----------------
            messageText.visibility = if (!message.text.isNullOrBlank()) {
                messageText.text = message.text
                View.VISIBLE
            } else View.GONE

            // ---------------- Image ----------------
            if (!effectiveImageUrl.isNullOrBlank()) {
                bindImageMedia(effectiveImageUrl, context, message.text.isNullOrBlank())
            } else {
                Glide.with(context).clear(messageImage)
                messageImage.setImageDrawable(null)
                messageImage.visibility = View.GONE
            }

            // ---------------- Audio ----------------
            if (!message.audioUrl.isNullOrBlank()) {
                audioContainer?.visibility = View.VISIBLE
                messageImage.visibility = View.GONE
                videoView?.visibility = View.GONE
                audioSeekBar?.progress = 0
                audioDuration?.text = formatTime(0)
                setupAudioPlayer(message.audioUrl, context)
            } else {
                audioContainer?.visibility = View.GONE
            }

            // ---------------- Video ----------------
            if (!effectiveVideoUrl.isNullOrBlank()) {
                bindVideoMedia(effectiveVideoUrl, context)
            } else {
                videoView?.visibility = View.GONE
            }

            // ---------------- Location ----------------
            if (message.location != null && layoutLocation != null) {
                layoutLocation.visibility = View.VISIBLE
                textLocation?.text = "View location"
                layoutLocation.setOnClickListener {
                    val intent = Intent(context, LocationPreviewActivity::class.java)
                    intent.putExtra("latitude", message.location.latitude)
                    intent.putExtra("longitude", message.location.longitude)
                    context.startActivity(intent)
                }
            } else {
                layoutLocation?.visibility = View.GONE
            }

            // ---------------- File ----------------
            if (!effectiveFileUrl.isNullOrBlank()) {
                layoutFile?.visibility = View.VISIBLE
                // ✅ Safely extract file name from URL if backend didn’t send one
                val fileName = effectiveFileUrl.substringAfterLast('/', "File")
                textFileName?.text = fileName
                layoutFile?.setOnClickListener {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            data = Uri.parse(effectiveFileUrl)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        context.startActivity(Intent.createChooser(intent, "Open file"))
                    } catch (_: ActivityNotFoundException) {
                        Toast.makeText(context, "No app found to open this file", Toast.LENGTH_SHORT).show()
                    } catch (e: Exception) {
                        Toast.makeText(context, "Could not open file", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                layoutFile?.visibility = View.GONE
            }


            // ---------------- Contact ----------------
            if (!message.contactInfo.isNullOrBlank()) {
                layoutContact?.visibility = View.VISIBLE
                textContactInfo?.text = message.contactInfo
            } else {
                layoutContact?.visibility = View.GONE
            }

            // ---------------- Timestamp ----------------
            val timestampLabel = formatTimestamp(message.timestamp)
            timestampText.text = if (message.isEdited && timestampLabel.isNotBlank()) {
                "$timestampLabel - edited"
            } else {
                timestampLabel
            }
        }

        // ------------------------------------------------------------
        // Audio Player Logic
        // ------------------------------------------------------------
        private fun setupAudioPlayer(url: String, context: android.content.Context) {
            releaseMediaPlayer()
            btnPlayAudio?.setOnClickListener {
                if (mediaPlayer == null) {
                    mediaPlayer = MediaPlayer().apply {
                        try {
                            setDataSource(url)
                            prepareAsync()
                            setOnPreparedListener { mp ->
                                mp.start()
                                audioSeekBar?.max = mp.duration
                                btnPlayAudio?.setImageResource(R.drawable.ic_pause)
                                handler?.post(updateSeekBar)
                            }
                            setOnCompletionListener { releaseMediaPlayer() }
                            setOnErrorListener { _, _, _ ->
                                releaseMediaPlayer()
                                Toast.makeText(context, "Error playing audio", Toast.LENGTH_SHORT).show()
                                true
                            }
                        } catch (e: Exception) {
                            releaseMediaPlayer()
                            Toast.makeText(context, "Cannot play audio", Toast.LENGTH_SHORT).show()
                        }
                    }
                } else if (mediaPlayer?.isPlaying == true) {
                    mediaPlayer?.pause()
                    btnPlayAudio?.setImageResource(R.drawable.ic_play)
                } else {
                    mediaPlayer?.start()
                    btnPlayAudio?.setImageResource(R.drawable.ic_pause)
                    handler?.post(updateSeekBar)
                }
            }
        }

        protected fun formatTimestamp(isoString: String?): String {
            if (isoString.isNullOrBlank()) return ""
            return try {
                val input = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                input.timeZone = TimeZone.getTimeZone("UTC")
                val date = input.parse(isoString) ?: return ""
                val output = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
                output.timeZone = TimeZone.getDefault()
                output.format(date)
            } catch (_: Exception) {
                ""
            }
        }

        private fun dpToPx(ctx: android.content.Context, dp: Int): Int {
            return (dp * ctx.resources.displayMetrics.density).toInt()
        }

        private fun bindImageMedia(imageUrl: String, context: android.content.Context, showFallbackCaption: Boolean) {
            bindImageMedia(imageUrl, context, showFallbackCaption, allowRetry = true)
        }

        private fun bindImageMedia(
            imageUrl: String,
            context: android.content.Context,
            showFallbackCaption: Boolean,
            allowRetry: Boolean
        ) {
            Log.d("MessageAdapter", "Binding image media URL: $imageUrl")
            messageImage.tag = imageUrl
            mediaContainer?.visibility = View.VISIBLE
            messageImage.visibility = View.VISIBLE
            mediaFallbackText?.visibility = View.GONE
            mediaFallbackText?.setOnClickListener(null)
            videoPlayOverlay?.visibility = View.GONE

            Glide.with(context)
                .load(imageUrl)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .placeholder(R.drawable.placeholder_image)
                .error(R.drawable.error_image)
                .listener(object : RequestListener<android.graphics.drawable.Drawable> {
                    override fun onLoadFailed(
                        e: GlideException?,
                        model: Any?,
                        target: Target<android.graphics.drawable.Drawable>,
                        isFirstResource: Boolean
                    ): Boolean {
                        if (messageImage.tag != imageUrl) {
                            Log.d("MessageAdapter", "Ignoring stale image failure for recycled view: $imageUrl")
                            return true
                        }
                        val shouldRetry = allowRetry && e.hasSocketClosedCause()
                        if (shouldRetry) {
                            Log.w("MessageAdapter", "Retrying image load after transient socket close: $imageUrl")
                            messageImage.post {
                                bindImageMedia(imageUrl, context, showFallbackCaption, allowRetry = false)
                            }
                            return true
                        }
                        Log.e("MessageAdapter", "Image message load failed: $imageUrl", e)
                        mediaFallbackText?.apply {
                            text = context.getString(R.string.chat_image_failed_retry)
                            visibility = View.VISIBLE
                            setOnClickListener { bindImageMedia(imageUrl, context, showFallbackCaption, allowRetry = true) }
                        }
                        if (showFallbackCaption) {
                            messageText.text = context.getString(R.string.chat_image_unavailable)
                            messageText.visibility = View.VISIBLE
                        }
                        return false
                    }

                    override fun onResourceReady(
                        resource: android.graphics.drawable.Drawable,
                        model: Any,
                        target: Target<android.graphics.drawable.Drawable>?,
                        dataSource: DataSource,
                        isFirstResource: Boolean
                    ): Boolean {
                        if (messageImage.tag != imageUrl) {
                            return true
                        }
                        Log.d("MessageAdapter", "Image message loaded: $imageUrl")
                        mediaFallbackText?.visibility = View.GONE
                        return false
                    }
                })
                .into(messageImage)

            messageImage.setOnClickListener {
                val intent = Intent(context, ImagePreviewActivity::class.java)
                intent.putExtra("imageUrl", imageUrl)
                context.startActivity(intent)
            }
        }

        private fun bindVideoMedia(videoUrl: String, context: android.content.Context) {
            Log.d("MessageAdapter", "Binding video media URL: $videoUrl")
            messageImage.tag = videoUrl
            mediaContainer?.visibility = View.VISIBLE
            messageImage.visibility = View.VISIBLE
            videoPlayOverlay?.visibility = View.VISIBLE
            mediaFallbackText?.visibility = View.GONE
            mediaFallbackText?.setOnClickListener(null)
            audioContainer?.visibility = View.GONE

            Glide.with(context)
                .asBitmap()
                .load(videoUrl)
                .frame(1_000_000)
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .placeholder(R.drawable.video_placeholder)
                .error(R.drawable.video_placeholder)
                .listener(object : RequestListener<android.graphics.Bitmap> {
                    override fun onLoadFailed(
                        e: GlideException?,
                        model: Any?,
                        target: Target<android.graphics.Bitmap>,
                        isFirstResource: Boolean
                    ): Boolean {
                        if (messageImage.tag != videoUrl) {
                            Log.d("MessageAdapter", "Ignoring stale video thumbnail failure for recycled view: $videoUrl")
                            return true
                        }
                        Log.e("MessageAdapter", "Video thumbnail load failed: $videoUrl", e)
                        mediaFallbackText?.apply {
                            text = context.getString(R.string.chat_video_failed_retry)
                            visibility = View.VISIBLE
                            setOnClickListener { bindVideoMedia(videoUrl, context) }
                        }
                        return false
                    }

                    override fun onResourceReady(
                        resource: android.graphics.Bitmap,
                        model: Any,
                        target: Target<android.graphics.Bitmap>?,
                        dataSource: DataSource,
                        isFirstResource: Boolean
                    ): Boolean {
                        if (messageImage.tag != videoUrl) {
                            return true
                        }
                        Log.d("MessageAdapter", "Video thumbnail loaded: $videoUrl")
                        mediaFallbackText?.visibility = View.GONE
                        return false
                    }
                })
                .into(messageImage)

            val playInline = View.OnClickListener {
                videoPlayOverlay?.visibility = View.GONE
                messageImage.visibility = View.GONE
                videoView?.visibility = View.VISIBLE
                videoView?.setVideoURI(Uri.parse(videoUrl))
                videoView?.setOnPreparedListener { mp ->
                    mp.isLooping = false
                    videoView.start()
                    videoView.setOnClickListener {
                        if (videoView.isPlaying) videoView.pause() else videoView.start()
                    }
                }
            }
            messageImage.setOnClickListener(playInline)
            videoPlayOverlay?.setOnClickListener(playInline)
        }

        private fun String?.isLikelyImageUrl(): Boolean {
            val normalized = this?.lowercase(Locale.getDefault()).orEmpty()
            return normalized.endsWith(".jpg") ||
                normalized.endsWith(".jpeg") ||
                normalized.endsWith(".png") ||
                normalized.endsWith(".webp") ||
                normalized.endsWith(".gif") ||
                normalized.contains("/image/upload/")
        }

        private fun String?.isLikelyVideoUrl(): Boolean {
            val normalized = this?.lowercase(Locale.getDefault()).orEmpty()
            return normalized.endsWith(".mp4") ||
                normalized.endsWith(".mov") ||
                normalized.endsWith(".m4v") ||
                normalized.endsWith(".webm") ||
                normalized.contains("/video/upload/")
        }

        private fun resetContentState() {
            releaseMediaPlayer()
            mediaContainer?.visibility = View.GONE
            Glide.with(itemView).clear(messageImage)
            messageImage.tag = null
            messageImage.setImageDrawable(null)
            messageImage.setOnClickListener(null)
            messageImage.visibility = View.GONE

            videoPlayOverlay?.visibility = View.GONE
            videoPlayOverlay?.setOnClickListener(null)
            mediaFallbackText?.visibility = View.GONE
            mediaFallbackText?.setOnClickListener(null)
            videoView?.setOnClickListener(null)
            videoView?.stopPlayback()
            videoView?.visibility = View.GONE

            audioContainer?.visibility = View.GONE
            layoutLocation?.setOnClickListener(null)
            layoutLocation?.visibility = View.GONE
            layoutFile?.setOnClickListener(null)
            layoutFile?.visibility = View.GONE
            layoutContact?.visibility = View.GONE
        }

        private fun resolveSenderName(message: ChatMessage, currentUserId: String, receiverName: String): String {
            return when {
                message.senderId == currentUserId -> "You"
                !receiverName.isNullOrBlank() -> receiverName
                message.sender?.username?.isNotBlank() == true -> message.sender!!.username!!
                else -> ""
            }
        }

        protected fun formatTime(milliseconds: Int): String {
            if (milliseconds < 0) return "00:00"
            val totalSeconds = milliseconds / 1000
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
        }

        fun releaseMediaPlayer() {
            handler?.removeCallbacks(updateSeekBar)
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.reset()
                it.release()
            }
            mediaPlayer = null
            btnPlayAudio?.setImageResource(R.drawable.ic_play)
            audioSeekBar?.progress = 0
            audioDuration?.text = formatTime(0)
        }

        fun recycleMediaState() {
            releaseMediaPlayer()
            Glide.with(itemView).clear(messageImage)
            messageImage.tag = null
            messageImage.setImageDrawable(null)
            videoView?.stopPlayback()
        }

        private fun GlideException?.hasSocketClosedCause(): Boolean {
            if (this == null) return false
            if (rootCauses.any { it is java.net.SocketException && it.message?.contains("Socket is closed", ignoreCase = true) == true }) {
                return true
            }
            return false
        }
    }


    // ------------------------------------------------------------
    // Sent / Received ViewHolders
    // ------------------------------------------------------------
   inner class SentMessageViewHolder(itemView: View) : BaseMessageViewHolder(itemView) {
        private val statusText: TextView = itemView.findViewById(R.id.textStatus)
        override fun bind(message: ChatMessage, currentUserId: String) {
            super.bind(message, currentUserId)
            statusText.text = when (message.status?.lowercase(Locale.getDefault())) {
                "read", "seen" -> "✓✓"
                "delivered" -> "✓✓"
                else -> "✓"
            }
        }
    }

    inner class ReceivedMessageViewHolder(itemView: View) : BaseMessageViewHolder(itemView)

    // ------------------------------------------------------------
    // Diff Callback
    // ------------------------------------------------------------
    class DiffCallback : DiffUtil.ItemCallback<ChatMessage>() {
        override fun areItemsTheSame(oldItem: ChatMessage, newItem: ChatMessage) =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: ChatMessage, newItem: ChatMessage) =
            oldItem == newItem
    }
}
