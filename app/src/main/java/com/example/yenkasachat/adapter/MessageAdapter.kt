package com.example.yenkasachat.adapter


import android.media.MediaPlayer
import android.net.Uri
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
        val layout = if (viewType == TYPE_SENT)
            R.layout.item_message_sent
        else
            R.layout.item_message_received

        val view = LayoutInflater.from(parent.context).inflate(layout, parent, false)
        return MessageViewHolder(view)
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        (holder as MessageViewHolder).bind(getItem(position))
    }

    class MessageViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {

        private val messageText: TextView = itemView.findViewById(R.id.textMessage)
        private val timestampText: TextView = itemView.findViewById(R.id.textTimestamp)
        private val messageImage: ImageView = itemView.findViewById(R.id.imageMessage)
        private val playAudioButton: ImageButton = itemView.findViewById(R.id.buttonPlayAudio)
        private val videoView: VideoView? = itemView.findViewById(R.id.videoMessage)

        private val layoutLocation: LinearLayout? = itemView.findViewById(R.id.layoutLocation)
        private val textLocation: TextView? = itemView.findViewById(R.id.textLocation)

        private val layoutFile: LinearLayout? = itemView.findViewById(R.id.layoutFile)
        private val textFileName: TextView? = itemView.findViewById(R.id.textFileName)

        private val layoutContact: LinearLayout? = itemView.findViewById(R.id.layoutContact)
        private val textContactInfo: TextView? = itemView.findViewById(R.id.textContactInfo)

        private var mediaPlayer: MediaPlayer? = null

        fun bind(message: ChatMessage) {
            val context = itemView.context

            // Handle Text
            if (!message.text.isNullOrBlank()) {
                messageText.visibility = View.VISIBLE
                messageText.text = message.text
            } else {
                messageText.visibility = View.GONE
            }

            // Handle Image
            if (!message.imageUrl.isNullOrBlank()) {
                messageImage.visibility = View.VISIBLE
                Glide.with(context)
                    .load(message.imageUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .error(R.drawable.error_image)
                    .into(messageImage)
            } else {
                messageImage.visibility = View.GONE
            }

            // Handle Audio
            if (!message.audioUrl.isNullOrBlank()) {
                playAudioButton.visibility = View.VISIBLE
                playAudioButton.setOnClickListener {
                    if (mediaPlayer == null) {
                        mediaPlayer = MediaPlayer().apply {
                            setDataSource(message.audioUrl)
                            prepare()
                            start()
                            setOnCompletionListener {
                                mediaPlayer?.release()
                                mediaPlayer = null
                                Toast.makeText(context, "✅ Audio Finished", Toast.LENGTH_SHORT).show()
                            }
                        }
                        Toast.makeText(context, "🎵 Playing audio...", Toast.LENGTH_SHORT).show()
                    } else {
                        mediaPlayer?.stop()
                        mediaPlayer?.release()
                        mediaPlayer = null
                        Toast.makeText(context, "⏹️ Audio stopped", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                playAudioButton.visibility = View.GONE
            }

            // Handle Video
            if (!message.videoUrl.isNullOrBlank() && videoView != null) {
                videoView.visibility = View.VISIBLE
                videoView.setVideoURI(Uri.parse(message.videoUrl))
                videoView.setOnPreparedListener { it.isLooping = true; it.start() }
            } else {
                videoView?.visibility = View.GONE
            }

            // Handle Location
            // Handle Location
            if (message.location != null && layoutLocation != null && textLocation != null) {
                layoutLocation.visibility = View.VISIBLE
                val lat = message.location.latitude
                val lon = message.location.longitude
                textLocation.text = "📍 $lat, $lon"
            } else {
                layoutLocation?.visibility = View.GONE
            }


            // Handle File
            if (!message.fileUrl.isNullOrBlank() && layoutFile != null && textFileName != null) {
                layoutFile.visibility = View.VISIBLE
                val fileName = message.fileUrl.substringAfterLast('/')
                textFileName.text = "\uD83D\uDCC4 $fileName"
            } else {
                layoutFile?.visibility = View.GONE
            }

            // Handle Contact
            if (!message.contactInfo.isNullOrBlank() && layoutContact != null && textContactInfo != null) {
                layoutContact.visibility = View.VISIBLE
                textContactInfo.text = "\uD83D\uDC65 ${message.contactInfo}"
            } else {
                layoutContact?.visibility = View.GONE
            }

            // Timestamp
            timestampText.text = formatTimestamp(message.timestamp)
        }

        private fun formatTimestamp(rawTimestamp: String?): String {
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
    }

    class DiffCallback : DiffUtil.ItemCallback<ChatMessage>() {
        override fun areItemsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem.messageId == newItem.messageId
        }

        override fun areContentsTheSame(oldItem: ChatMessage, newItem: ChatMessage): Boolean {
            return oldItem == newItem
        }
    }
}
