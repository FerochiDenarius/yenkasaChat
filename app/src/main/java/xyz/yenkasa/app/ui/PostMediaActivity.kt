package xyz.yenkasa.app.ui

import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.model.ViewRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch


class PostMediaActivity : AppCompatActivity() {

    private lateinit var textUsername: TextView
    private lateinit var textCaption: TextView
    private lateinit var imageView: ImageView

    private lateinit var videoView: VideoView
    private lateinit var videoPlayPauseBtn: ImageButton
    private lateinit var videoMuteBtn: ImageButton

    private lateinit var audioView: LinearLayout
    private lateinit var audioSeekBar: SeekBar
    private lateinit var audioPlayBtn: ImageButton
    private lateinit var audioPauseBtn: ImageButton
    private lateinit var audioTitle: TextView
    private lateinit var audioCurrentTime: TextView
    private lateinit var audioTotalTime: TextView

    private var mediaUrl: String? = null
    private var mediaType: String? = null
    private var username: String? = null
    private var caption: String? = null

    private var audioPlayer: MediaPlayer? = null
    private var handler = Handler(Looper.getMainLooper())
    private var isAudioPrepared = false
    private var isVideoMuted = false
    private var hasRecordedView = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_post_media)

        // Bind views
        textUsername = findViewById(R.id.textUsername)
        textCaption = findViewById(R.id.textCaption)
        imageView = findViewById(R.id.imageView)

        videoView = findViewById(R.id.videoView)
        videoPlayPauseBtn = findViewById(R.id.videoPlayPauseBtn)
        videoMuteBtn = findViewById(R.id.videoMuteBtn)

        audioView = findViewById(R.id.audioView)
        audioSeekBar = findViewById(R.id.audioSeekBar)
        audioPlayBtn = findViewById(R.id.audioPlayBtn)
        audioPauseBtn = findViewById(R.id.audioPauseBtn)
        audioTitle = findViewById(R.id.audioTitle)
        audioCurrentTime = findViewById(R.id.audioCurrentTime)
        audioTotalTime = findViewById(R.id.audioTotalTime)

        // Get Intent data (correct keys)
        mediaUrl = intent.getStringExtra("MEDIA_URL")
        mediaType = intent.getStringExtra("MEDIA_TYPE")
        username = intent.getStringExtra("USERNAME")
        caption = intent.getStringExtra("CAPTION")

        // Set UI text
        textUsername.text = username ?: "Unknown User"
        textCaption.text = caption ?: ""

        // Load media
        when (mediaType) {
            "image" -> showImage()
            "video" -> showVideo()
            "audio" -> showAudio()
            else -> Toast.makeText(this, "Unknown media type", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showImage() {
        imageView.visibility = View.VISIBLE
        videoView.visibility = View.GONE
        audioView.visibility = View.GONE

        Glide.with(this)
            .load(mediaUrl)
            .placeholder(R.drawable.placeholder_image)
            .into(imageView)

        handler.postDelayed({ rewardView(3) }, 3000)
    }

    private fun showVideo() {
        imageView.visibility = View.GONE
        videoView.visibility = View.VISIBLE
        audioView.visibility = View.GONE

        val uri = Uri.parse(mediaUrl)
        videoView.setVideoURI(uri)

        videoView.setOnPreparedListener { mp ->
            mp.isLooping = true
            mp.setVolume(1f, 1f) // ensure sound plays
            videoView.start()
            handler.postDelayed({
                if (videoView.isPlaying) rewardView(10)
            }, 10000)

            // play/pause
            videoPlayPauseBtn.setOnClickListener {
                if (videoView.isPlaying) {
                    videoView.pause()
                    videoPlayPauseBtn.setImageResource(R.drawable.ic_play)
                } else {
                    videoView.start()
                    handler.postDelayed({
                        if (videoView.isPlaying) rewardView(10)
                    }, 10000)

                    videoPlayPauseBtn.setImageResource(R.drawable.ic_pause)
                }
            }

            // mute/unmute
            videoMuteBtn.setOnClickListener {
                isVideoMuted = !isVideoMuted
                if (isVideoMuted) {
                    mp.setVolume(0f, 0f)
                    videoMuteBtn.setImageResource(R.drawable.ic_volume_off)
                } else {
                    mp.setVolume(1f, 1f)
                    videoMuteBtn.setImageResource(R.drawable.ic_volume_up)
                }
            }
        }

        videoView.setOnErrorListener { _, what, extra ->
            Toast.makeText(this, "Error playing video ($what, $extra)", Toast.LENGTH_SHORT).show()
            true
        }
    }

    private fun showAudio() {
        imageView.visibility = View.GONE
        videoView.visibility = View.GONE
        audioView.visibility = View.VISIBLE

        audioPlayer = MediaPlayer()

        try {
            audioPlayer!!.setDataSource(mediaUrl)
            audioPlayer!!.prepareAsync()
        } catch (e: Exception) {
            Toast.makeText(this, "Audio load error", Toast.LENGTH_SHORT).show()
            return
        }

        audioPlayer!!.setOnPreparedListener { mp ->
            isAudioPrepared = true
            audioSeekBar.max = mp.duration
            audioTotalTime.text = formatTime(mp.duration)
            audioTitle.text = "Audio"

            audioPlayBtn.visibility = View.VISIBLE
            audioPauseBtn.visibility = View.GONE

            startSeekbarUpdate()
        }

        audioPlayBtn.setOnClickListener {
            if (isAudioPrepared) {
                audioPlayer?.start()
                audioPlayBtn.visibility = View.GONE
                audioPauseBtn.visibility = View.VISIBLE
                handler.postDelayed({
                    if (audioPlayer?.isPlaying == true) rewardView(20)
                }, 20000)
            }
        }

        audioPauseBtn.setOnClickListener {
            audioPlayer?.pause()
            audioPlayBtn.visibility = View.VISIBLE
            audioPauseBtn.visibility = View.GONE
        }

        audioSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser && isAudioPrepared) {
                    audioPlayer?.seekTo(progress)
                    audioCurrentTime.text = formatTime(progress)
                }
            }

            override fun onStartTrackingTouch(sb: SeekBar?) {}
            override fun onStopTrackingTouch(sb: SeekBar?) {}
        })
    }

    private fun startSeekbarUpdate() {
        handler.postDelayed(object : Runnable {
            override fun run() {
                audioPlayer?.let {
                    if (it.isPlaying) {
                        val pos = it.currentPosition
                        audioSeekBar.progress = pos
                        audioCurrentTime.text = formatTime(pos)
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
        if (videoView.isPlaying) videoView.pause()
        audioPlayer?.pause()
    }

    override fun onDestroy() {
        super.onDestroy()
        videoView.stopPlayback()
        audioPlayer?.release()
        handler.removeCallbacksAndMessages(null)


    }

    private fun rewardView(durationSeconds: Int) {
        if (hasRecordedView) return

        val postId = intent.getStringExtra("POST_ID") ?: return
        val token = TokenManager.getToken(this) ?: return
        hasRecordedView = true

        // Determine mediaType for reward
        val mediaType = when (mediaType?.lowercase()) {
            "video" -> "video"
            "audio" -> "audio"
            "image" -> "image"
            else -> "text"
        }

        // Launch coroutine because recordView() is suspend
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = ApiClient.apiService.recordView(
                    postId,
                    "Bearer $token",
                    ViewRequest(
                        watchDuration = durationSeconds,
                        mediaType = mediaType  // ⭐ REQUIRED PARAMETER
                    )
                )

                if (response.isSuccessful) {
                    // reward recorded successfully (no UI update needed)
                } else {
                    hasRecordedView = false
                }

            } catch (e: Exception) {
                hasRecordedView = false
            }
        }
    }


}
