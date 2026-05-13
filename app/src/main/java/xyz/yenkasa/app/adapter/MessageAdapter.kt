package xyz.yenkasa.app.adapter

import android.content.Intent
import android.media.MediaPlayer
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.ui.LocationPreviewActivity
import xyz.yenkasa.app.ui.chatmedia.YenkasaChatMediaView
import java.text.SimpleDateFormat
import java.util.*


class MessageAdapter(
    private val currentUserId: String,
    private val receiverName: String,
    private val isGroupChat: Boolean = false
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
        protected val chatMediaView: YenkasaChatMediaView = itemView.findViewById(R.id.chatMediaView)
        protected val senderNameText: TextView? = itemView.findViewById(R.id.textSenderName)

        protected val audioContainer: LinearLayout? = itemView.findViewById(R.id.audioContainer)
        protected val btnPlayAudio: ImageButton? = itemView.findViewById(R.id.btnPlayAudio)
        protected val audioSeekBar: SeekBar? = itemView.findViewById(R.id.audioSeekBar)
        protected val audioDuration: TextView? = itemView.findViewById(R.id.audioDuration)

        protected val layoutLocation: LinearLayout? = itemView.findViewById(R.id.layoutLocation)
        protected val textLocation: TextView? = itemView.findViewById(R.id.textLocation)

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
            if (isGroupChat) {
                senderNameText?.text = resolveSenderName(message, currentUserId, receiverName)
                senderNameText?.visibility = View.VISIBLE
            } else {
                senderNameText?.visibility = View.GONE
            }

            val mediaPayload = YenkasaChatMediaView.inferPayload(
                imageUrl = message.imageUrl,
                videoUrl = message.videoUrl,
                fileUrl = message.fileUrl
            )

            if (message.messageType == "laugh_reaction") {
                messageText.text = message.text ?: "😂"
                messageText.textSize = 26f
                messageText.visibility = View.VISIBLE
                chatMediaView.release()
                chatMediaView.visibility = View.GONE
                audioContainer?.visibility = View.GONE
                layoutLocation?.visibility = View.GONE
                layoutContact?.visibility = View.GONE
                timestampText.text = formatTimestamp(message.timestamp)
                return
            }
            messageText.textSize = 15f

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

            // ---------------- Image / Video / File ----------------
            chatMediaView.bind(mediaPayload)

            // ---------------- Audio ----------------
            if (!message.audioUrl.isNullOrBlank()) {
                audioContainer?.visibility = View.VISIBLE
                chatMediaView.visibility = View.GONE
                audioSeekBar?.progress = 0
                audioDuration?.text = formatTime(0)
                setupAudioPlayer(message.audioUrl, context)
            } else {
                audioContainer?.visibility = View.GONE
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

        private fun resetContentState() {
            releaseMediaPlayer()
            chatMediaView.release()
            chatMediaView.visibility = View.GONE

            audioContainer?.visibility = View.GONE
            layoutLocation?.setOnClickListener(null)
            layoutLocation?.visibility = View.GONE
            layoutContact?.visibility = View.GONE
        }

        private fun resolveSenderName(message: ChatMessage, currentUserId: String, receiverName: String): String {
            return when {
                message.senderId == currentUserId -> "You"
                message.sender?.username?.isNotBlank() == true -> message.sender!!.username!!
                receiverName.isNotBlank() -> receiverName
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
            chatMediaView.release()
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

    fun pauseAllVideos() {
        YenkasaChatMediaView.pauseActiveVideo()
    }
}
