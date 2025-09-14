package com.example.yenkasachat.adapter

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper // Import Looper for Handler
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.*
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.ui.ImagePreviewActivity
import com.example.yenkasachat.ui.LocationPreviewActivity
import java.text.SimpleDateFormat
import java.util.*

class MessageAdapter(private val senderId: String) :
    ListAdapter<ChatMessage, RecyclerView.ViewHolder>(DiffCallback()) {

    // 1. Define the interface for long-press callbacks
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

        return if (getItem(position).actualSenderId == senderId) TYPE_SENT else TYPE_RECEIVED
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

        // 2. Set the long-press listener on the itemView
        holder.itemView.setOnLongClickListener {
            // Pass the item view itself if you need to anchor a PopupMenu to it
            longClickListener?.onMessageLongClicked(message, it, holder.adapterPosition)
            true // Return true to indicate the event was consumed
        }

        if (holder is SentMessageViewHolder) {
            holder.bind(message)
        } else if (holder is ReceivedMessageViewHolder) {
            holder.bind(message)
        }
    }

    override fun onViewRecycled(holder: RecyclerView.ViewHolder) {
        if (holder is SentMessageViewHolder) {
            holder.releaseMediaPlayer()
        } else if (holder is ReceivedMessageViewHolder) {
            holder.releaseMediaPlayer()
        }
        super.onViewRecycled(holder)
    }

    abstract class BaseMessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        // ... (your existing ViewHolder code is good)
        // Make sure you have R.drawable.placeholder_image and R.drawable.error_image
        // Also R.drawable.ic_pause and R.drawable.ic_play

        protected val messageText: TextView = itemView.findViewById(R.id.textMessage)
        protected val timestampText: TextView = itemView.findViewById(R.id.textTimestamp)
        protected val messageImage: ImageView = itemView.findViewById(R.id.imageMessage)
        protected val videoView: VideoView? = itemView.findViewById(R.id.videoMessage)

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

        protected var mediaPlayer: MediaPlayer? = null
        // Ensure Handler is imported from android.os.Handler
        // And initialized with Looper.getMainLooper() if created on a background thread,
        // but here it's likely fine as it's tied to UI updates.
        protected var handler: Handler? = Handler(Looper.getMainLooper()) // Initialize Handler
        protected val updateSeekBar = object : Runnable {
            override fun run() {
                mediaPlayer?.let { mp ->
                    if (mp.isPlaying) { // Check if media player is still valid and playing
                        audioSeekBar?.progress = mp.currentPosition
                        audioDuration?.text = formatTime(mp.currentPosition)
                        handler?.postDelayed(this, 500)
                    }
                }
            }
        }


        open fun bind(message: ChatMessage) {
            val context = itemView.context

            // Text
            messageText.visibility = if (!message.text.isNullOrBlank()) {
                messageText.text = message.text
                View.VISIBLE
            } else View.GONE

            // Image
            if (!message.imageUrl.isNullOrBlank()) {
                messageImage.visibility = View.VISIBLE
                Glide.with(context)
                    .load(message.imageUrl)
                    .placeholder(R.drawable.placeholder_image) // Ensure this drawable exists
                    .error(R.drawable.error_image)       // Ensure this drawable exists
                    .into(messageImage)

                messageImage.setOnClickListener {
                    val intent = Intent(context, ImagePreviewActivity::class.java)
                    intent.putExtra("imageUrl", message.imageUrl)
                    context.startActivity(intent)
                }
            } else {
                messageImage.visibility = View.GONE
            }

            // Audio
            if (!message.audioUrl.isNullOrBlank() && audioContainer != null && btnPlayAudio != null && audioSeekBar != null && audioDuration != null) {
                audioContainer.visibility = View.VISIBLE
                // Reset audio state for recycled views
                releaseMediaPlayer() // Good to call here to reset before binding new audio

                btnPlayAudio.setOnClickListener {
                    if (mediaPlayer == null) {
                        mediaPlayer = MediaPlayer().apply {
                            try {
                                setDataSource(message.audioUrl)
                                prepareAsync() // Use prepareAsync for network streams
                                setOnPreparedListener { mp ->
                                    mp.start()
                                    audioSeekBar.max = mp.duration
                                    btnPlayAudio.setImageResource(R.drawable.ic_pause) // Ensure this drawable exists
                                    handler?.post(updateSeekBar)
                                }
                                setOnCompletionListener {
                                    releaseMediaPlayer()
                                }
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
                        btnPlayAudio.setImageResource(R.drawable.ic_play) // Ensure this drawable exists
                        handler?.removeCallbacks(updateSeekBar)
                    } else {
                        mediaPlayer?.start()
                        btnPlayAudio.setImageResource(R.drawable.ic_pause)
                        handler?.post(updateSeekBar)
                    }
                }

                audioSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                        if (fromUser && mediaPlayer != null && mediaPlayer!!.isPlaying) { // Check if media player is prepared
                            try{
                                mediaPlayer?.seekTo(progress)
                            } catch(e: IllegalStateException){
                                // Handle case where mediaPlayer might not be in a valid state to seek
                            }
                        }
                    }
                    override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                    override fun onStopTrackingTouch(seekBar: SeekBar?) {}
                })
            } else {
                audioContainer?.visibility = View.GONE
                releaseMediaPlayer() // Also release if there's no audio URL for this item
            }


            // Video
            if (!message.videoUrl.isNullOrBlank() && videoView != null) {
                videoView.visibility = View.VISIBLE
                videoView.setVideoURI(Uri.parse(message.videoUrl))
                videoView.setOnPreparedListener { player ->
                    // player.isLooping = true // You might want to control this more explicitly
                }
                // Consider adding MediaController for better video controls
                videoView.setOnClickListener {
                    if (!videoView.isPlaying) videoView.start() else videoView.pause()
                }
            } else {
                videoView?.visibility = View.GONE
            }

            // Location
            if (message.location != null && layoutLocation != null && textLocation != null) {
                layoutLocation.visibility = View.VISIBLE
                val lat = message.location.latitude
                val lon = message.location.longitude
                textLocation.text = "📍 $lat, $lon" // Consider using String resources for "📍 "

                layoutLocation.setOnClickListener {
                    val intent = Intent(context, LocationPreviewActivity::class.java)
                    intent.putExtra("latitude", lat)
                    intent.putExtra("longitude", lon)
                    context.startActivity(intent)
                }
            } else {
                layoutLocation?.visibility = View.GONE
            }

            // File
            if (!message.fileUrl.isNullOrBlank() && layoutFile != null && textFileName != null) {
                layoutFile.visibility = View.VISIBLE
                // Potentially improve file name extraction if URLs are complex
                val fileName = message.fileUrl.substringAfterLast('/')
                textFileName.text = "📄 $fileName" // Consider using String resources for "📄 "
                layoutFile.setOnClickListener {
                    // TODO: Implement file opening logic
                    //  val intent = Intent(Intent.ACTION_VIEW)
                    //  intent.data = Uri.parse(message.fileUrl) // This might not be enough depending on file type and storage
                    //  intent.flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
                    //  try {
                    //      context.startActivity(intent)
                    //  } catch (e: ActivityNotFoundException) {
                    //      Toast.makeText(context, "No app to open this file", Toast.LENGTH_SHORT).show()
                    //  }
                }
            } else {
                layoutFile?.visibility = View.GONE
            }

            // Contact
            if (!message.contactInfo.isNullOrBlank() && layoutContact != null && textContactInfo != null) {
                layoutContact.visibility = View.VISIBLE
                textContactInfo.text = "👥 ${message.contactInfo}" // Consider using String resources for "👥 "
                layoutContact.setOnClickListener {
                    // TODO: Implement contact viewing or saving logic
                }
            } else {
                layoutContact?.visibility = View.GONE
            }

            // Timestamp
            timestampText.text = formatTimestamp(message.timestamp)
        }

        protected fun formatTimestamp(rawTimestamp: String?): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC") // Assuming timestamp is UTC
                val date = inputFormat.parse(rawTimestamp ?: "")
                // Consider using device's default locale for output format
                val outputFormat = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
                outputFormat.timeZone = TimeZone.getDefault() // Format in local timezone
                outputFormat.format(date ?: Date())
            } catch (e: Exception) {
                // Log.e("MessageAdapter", "Error parsing timestamp: $rawTimestamp", e)
                rawTimestamp ?: ""
            }
        }

        protected fun formatTime(milliseconds: Int): String {
            if (milliseconds < 0) return "00:00" // Handle invalid duration
            val totalSeconds = milliseconds / 1000
            val minutes = totalSeconds / 60
            val seconds = totalSeconds % 60
            return String.format(Locale.getDefault(), "%02d:%02d", minutes, seconds)
        }

        fun releaseMediaPlayer() {
            handler?.removeCallbacks(updateSeekBar)
            mediaPlayer?.let {
                if (it.isPlaying) {
                    it.stop()
                }
                it.reset() // Use reset() before release() for cleaner state
                it.release()
            }
            mediaPlayer = null
            btnPlayAudio?.setImageResource(R.drawable.ic_play)
            audioSeekBar?.progress = 0
            audioDuration?.text = formatTime(0) // Reset duration text
        }
    }

    class SentMessageViewHolder(itemView: View) : BaseMessageViewHolder(itemView)
    class ReceivedMessageViewHolder(itemView: View) : BaseMessageViewHolder(itemView)

    class DiffCallback : DiffUtil.ItemCallback<ChatMessage>() {
        override fun areItemsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem.messageId == newItem.messageId
        }

        override fun areContentsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem == newItem
        }
    }
}
