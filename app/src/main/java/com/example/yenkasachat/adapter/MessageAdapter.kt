package com.example.yenkasachat.adapter

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
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

    companion object {
        private const val TYPE_SENT = 1
        private const val TYPE_RECEIVED = 2
    }

    override fun getItemViewType(position: Int): Int {
        return if (getItem(position).senderId == senderId) TYPE_SENT else TYPE_RECEIVED
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
        protected var handler: Handler? = null
        protected val updateSeekBar = object : Runnable {
            override fun run() {
                mediaPlayer?.let {
                    audioSeekBar?.progress = it.currentPosition
                    audioDuration?.text = formatTime(it.currentPosition)
                    handler?.postDelayed(this, 500)
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
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.error_image)
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
                btnPlayAudio.setOnClickListener {
                    if (mediaPlayer == null) {
                        mediaPlayer = MediaPlayer().apply {
                            setDataSource(message.audioUrl)
                            prepare()
                            start()
                            audioSeekBar.max = duration
                            btnPlayAudio.setImageResource(R.drawable.ic_pause)
                            setOnCompletionListener {
                                releaseMediaPlayer()
                            }
                        }
                        handler = Handler()
                        handler?.post(updateSeekBar)
                    } else if (mediaPlayer?.isPlaying == true) {
                        mediaPlayer?.pause()
                        btnPlayAudio.setImageResource(R.drawable.ic_play)
                    } else {
                        mediaPlayer?.start()
                        btnPlayAudio.setImageResource(R.drawable.ic_pause)
                    }
                }

                audioSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                        if (fromUser) {
                            mediaPlayer?.seekTo(progress)
                        }
                    }
                    override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                    override fun onStopTrackingTouch(seekBar: SeekBar?) {}
                })
            } else {
                audioContainer?.visibility = View.GONE
            }

            // Video
            if (!message.videoUrl.isNullOrBlank() && videoView != null) {
                videoView.visibility = View.VISIBLE
                videoView.setVideoURI(Uri.parse(message.videoUrl))
                videoView.setOnPreparedListener { player ->
                    player.isLooping = true
                }
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
                textLocation.text = "📍 $lat, $lon"

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
                val fileName = message.fileUrl.substringAfterLast('/')
                textFileName.text = "📄 $fileName"
            } else {
                layoutFile?.visibility = View.GONE
            }

            // Contact
            if (!message.contactInfo.isNullOrBlank() && layoutContact != null && textContactInfo != null) {
                layoutContact.visibility = View.VISIBLE
                textContactInfo.text = "👥 ${message.contactInfo}"
            } else {
                layoutContact?.visibility = View.GONE
            }

            // Timestamp
            timestampText.text = formatTimestamp(message.timestamp)
        }

        protected fun formatTimestamp(rawTimestamp: String?): String {
            return try {
                val inputFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
                inputFormat.timeZone = TimeZone.getTimeZone("UTC")
                val date = inputFormat.parse(rawTimestamp ?: "")
                val outputFormat = SimpleDateFormat("MMM dd, h:mm a", Locale.getDefault())
                outputFormat.format(date ?: Date())
            } catch (e: Exception) {
                rawTimestamp ?: ""
            }
        }

        protected fun formatTime(milliseconds: Int): String {
            val minutes = (milliseconds / 1000) / 60
            val seconds = (milliseconds / 1000) % 60
            return String.format("%02d:%02d", minutes, seconds)
        }

        fun releaseMediaPlayer() {
            handler?.removeCallbacks(updateSeekBar)
            mediaPlayer?.release()
            mediaPlayer = null
            btnPlayAudio?.setImageResource(R.drawable.ic_play)
            audioSeekBar?.progress = 0
            audioDuration?.text = "00:00"
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
