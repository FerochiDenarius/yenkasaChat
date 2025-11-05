package com.example.yenkasachat.ui

import android.content.Intent
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Post
import android.widget.MediaController

class PostMediaActivity : AppCompatActivity() {

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var imageView: ImageView
    private lateinit var videoView: VideoView
    private lateinit var audioView: LinearLayout
    private lateinit var audioPlayBtn: ImageButton
    private lateinit var audioPauseBtn: ImageButton
    private lateinit var audioTitle: TextView
    private lateinit var audioSeekBar: SeekBar

    private var mediaPlayer: MediaPlayer? = null
    private var post: Post? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isAudioPrepared = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_media)

        textUsername = findViewById(R.id.textUsername)
        textCaption = findViewById(R.id.textCaption)
        imageView = findViewById(R.id.imageView)
        videoView = findViewById(R.id.videoView)
        audioView = findViewById(R.id.audioView)
        audioPlayBtn = findViewById(R.id.audioPlayBtn)
        audioPauseBtn = findViewById(R.id.audioPauseBtn)
        audioTitle = findViewById(R.id.audioTitle)
        audioSeekBar = findViewById(R.id.audioSeekBar)

        post = intent.getParcelableExtra("POST_DATA")
        if (post == null) {
            Log.e("PostMediaActivity", "No post data passed")
            finish()
            return
        }

        setupUI()
    }

    private fun setupUI() {
        textUsername.text = post?.userId?.username ?: "Unknown"
        textCaption.text = post?.caption ?: ""

        // Hide all initially
        imageView.visibility = View.GONE
        videoView.visibility = View.GONE
        audioView.visibility = View.GONE

        when (post?.mediaType) {
            "image" -> showImage()
            "video" -> playVideo()
            "audio" -> setupAudio()
        }
    }

    // -------------------------------
    // Image handling with fullscreen
    // -------------------------------
    private fun showImage() {
        imageView.visibility = View.VISIBLE
        Glide.with(this)
            .load(post?.mediaUrl)
            .placeholder(R.drawable.placeholder)
            .error(R.drawable.placeholder)
            .into(imageView)

        imageView.setOnClickListener {
            val intent = Intent(this, FullscreenImageActivity::class.java)
            intent.putExtra("IMAGE_URL", post?.mediaUrl)
            startActivity(intent)
        }
    }

    // -------------------------------
    // Video handling with MediaController
    // -------------------------------
    private fun playVideo() {
        videoView.visibility = View.VISIBLE
        val uri = Uri.parse(post?.mediaUrl)
        videoView.setVideoURI(uri)

        val mediaController = MediaController(this)
        mediaController.setAnchorView(videoView)
        videoView.setMediaController(mediaController)

        videoView.setOnPreparedListener { mp ->
            mp.isLooping = false
            videoView.start()
        }

        videoView.setOnCompletionListener {
            videoView.seekTo(0)
        }

        videoView.setOnErrorListener { _, what, extra ->
            Log.e("PostMediaActivity", "Video playback error what=$what extra=$extra")
            Toast.makeText(this, "Failed to play video", Toast.LENGTH_SHORT).show()
            true
        }
    }

    // -------------------------------
    // Audio handling with SeekBar
    // -------------------------------
    private fun setupAudio() {
        audioView.visibility = View.VISIBLE
        audioTitle.text = post?.mediaUrl?.substringAfterLast("/") ?: "Audio"
        audioPlayBtn.isEnabled = false
        audioPauseBtn.isEnabled = false

        mediaPlayer = MediaPlayer().apply {
            setDataSource(post?.mediaUrl)
            prepareAsync()
            setOnPreparedListener {
                isAudioPrepared = true
                audioPlayBtn.isEnabled = true
                audioPauseBtn.isEnabled = true
                audioSeekBar.max = duration
                updateAudioSeekBar()
            }
            setOnCompletionListener {
                seekTo(0)
                audioPlayBtn.visibility = View.VISIBLE
                audioPauseBtn.visibility = View.GONE
            }
            setOnErrorListener { mp, what, extra ->
                Log.e("PostMediaActivity", "Audio playback error what=$what extra=$extra")
                Toast.makeText(this@PostMediaActivity, "Failed to play audio", Toast.LENGTH_SHORT).show()
                true
            }
        }

        audioPlayBtn.setOnClickListener {
            if (isAudioPrepared) {
                mediaPlayer?.start()
                audioPlayBtn.visibility = View.GONE
                audioPauseBtn.visibility = View.VISIBLE
                updateAudioSeekBar()
            }
        }

        audioPauseBtn.setOnClickListener {
            mediaPlayer?.pause()
            audioPauseBtn.visibility = View.GONE
            audioPlayBtn.visibility = View.VISIBLE
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
    }

    private fun updateAudioSeekBar() {
        mediaPlayer?.let { mp ->
            if (mp.isPlaying) {
                audioSeekBar.progress = mp.currentPosition
                handler.postDelayed({ updateAudioSeekBar() }, 500)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        mediaPlayer?.release()
        mediaPlayer = null
    }
}
