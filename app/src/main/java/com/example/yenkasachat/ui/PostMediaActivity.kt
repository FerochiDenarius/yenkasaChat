package com.example.yenkasachat.ui

import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer

class PostMediaActivity : AppCompatActivity() {

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var imageView: ImageView
    private lateinit var videoView: VideoView
    private lateinit var audioView: LinearLayout
    private lateinit var audioSeekBar: SeekBar
    private lateinit var audioPlayBtn: ImageButton
    private lateinit var audioPauseBtn: ImageButton
    private lateinit var audioTitle: TextView

    private var exoPlayer: ExoPlayer? = null
    private var audioPlayer: MediaPlayer? = null
    private var isAudioPrepared = false
    private var handler = android.os.Handler()

    private var mediaUrl: String? = null
    private var mediaType: String? = null
    private var username: String? = null
    private var caption: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_media)

        // === Bind views ===
        textUsername = findViewById(R.id.textUsername)
        textCaption = findViewById(R.id.textCaption)
        imageView = findViewById(R.id.imageView)
        videoView = findViewById(R.id.videoView)
        audioView = findViewById(R.id.audioView)
        audioSeekBar = findViewById(R.id.audioSeekBar)
        audioPlayBtn = findViewById(R.id.audioPlayBtn)
        audioPauseBtn = findViewById(R.id.audioPauseBtn)
        audioTitle = findViewById(R.id.audioTitle)

        // === Get Intent data ===
        mediaUrl = intent.getStringExtra("mediaUrl")
        mediaType = intent.getStringExtra("mediaType")
        username = intent.getStringExtra("username")
        caption = intent.getStringExtra("caption")

        // === Set text data ===
        textUsername.text = username ?: "Unknown User"
        textCaption.text = caption ?: ""

        // === Show relevant media ===
        when (mediaType) {
            "image" -> showImage()
            "video" -> showVideo()
            "audio" -> showAudio()
            else -> Toast.makeText(this, "Unknown media type", Toast.LENGTH_SHORT).show()
        }
    }

    // === IMAGE HANDLING ===
    private fun showImage() {
        imageView.visibility = View.VISIBLE
        videoView.visibility = View.GONE
        audioView.visibility = View.GONE

        Glide.with(this)
            .load(mediaUrl)
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .into(imageView)
    }

    // === VIDEO HANDLING ===
    private fun showVideo() {
        imageView.visibility = View.GONE
        videoView.visibility = View.VISIBLE
        audioView.visibility = View.GONE

        videoView.setVideoURI(Uri.parse(mediaUrl))
        videoView.setOnPreparedListener { mp ->
            mp.isLooping = true
            videoView.start()
        }
        videoView.setOnErrorListener { _, what, extra ->
            Toast.makeText(this, "Error playing video ($what, $extra)", Toast.LENGTH_SHORT).show()
            true
        }
    }

    // === AUDIO HANDLING ===
    private fun showAudio() {
        imageView.visibility = View.GONE
        videoView.visibility = View.GONE
        audioView.visibility = View.VISIBLE

        audioPlayer = MediaPlayer().apply {
            setDataSource(mediaUrl)
            prepareAsync()
            setOnPreparedListener {
                isAudioPrepared = true
                audioSeekBar.max = it.duration
                audioTitle.text = "Audio ready (${formatTime(it.duration)})"
            }
        }

        audioPlayBtn.setOnClickListener {
            if (isAudioPrepared) {
                audioPlayer?.start()
                audioPlayBtn.visibility = View.GONE
                audioPauseBtn.visibility = View.VISIBLE
                startSeekbarUpdate()
            }
        }

        audioPauseBtn.setOnClickListener {
            audioPlayer?.pause()
            audioPlayBtn.visibility = View.VISIBLE
            audioPauseBtn.visibility = View.GONE
        }

        audioSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser && isAudioPrepared) {
                    audioPlayer?.seekTo(progress)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
    }

    private fun startSeekbarUpdate() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                audioPlayer?.let {
                    if (it.isPlaying) {
                        audioSeekBar.progress = it.currentPosition
                        handler.postDelayed(this, 1000)
                    }
                }
            }
        }, 1000)
    }

    private fun formatTime(ms: Int): String {
        val totalSecs = ms / 1000
        val mins = totalSecs / 60
        val secs = totalSecs % 60
        return String.format("%d:%02d", mins, secs)
    }

    override fun onPause() {
        super.onPause()
        videoView.pause()
        audioPlayer?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        videoView.stopPlayback()
        audioPlayer?.release()
        exoPlayer?.release()
        handler.removeCallbacksAndMessages(null)
    }
}
