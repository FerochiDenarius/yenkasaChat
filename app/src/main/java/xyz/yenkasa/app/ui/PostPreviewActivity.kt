package xyz.yenkasa.app.ui

import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import androidx.media3.common.MediaItem
import androidx.media3.exoplayer.ExoPlayer
import xyz.yenkasa.app.ui.player.YenkasaVideoPlayerView
import xyz.yenkasa.app.util.EdgeToEdgeInsets

class PostPreviewActivity : AppCompatActivity() {

    private lateinit var imageView: ImageView
    private lateinit var playerView: YenkasaVideoPlayerView
    private lateinit var audioLayout: LinearLayout
    private lateinit var btnPlayAudio: ImageButton
    private lateinit var btnPauseAudio: ImageButton
    private lateinit var seekBar: SeekBar
    private lateinit var txtTimer: TextView

    private var player: ExoPlayer? = null
    private var mediaType: String? = null
    private var mediaUrl: String? = null

    private var isAudioPrepared = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        EdgeToEdgeInsets.enableEdgeToEdge(this, lightStatusBars = false, lightNavigationBars = false)
        setContentView(R.layout.activity_post_preview)

        // === Bind views ===
        imageView = findViewById(R.id.previewImageView)
        playerView = findViewById(R.id.previewVideoView)
        audioLayout = findViewById(R.id.audioLayout)
        btnPlayAudio = findViewById(R.id.btnPlayAudio)
        btnPauseAudio = findViewById(R.id.btnPauseAudio)
        seekBar = findViewById(R.id.seekBarAudio)
        txtTimer = findViewById(R.id.txtAudioTimer)
        EdgeToEdgeInsets.applySystemBarPadding(audioLayout, left = true, right = true, bottom = true)

        mediaType = intent.getStringExtra("mediaType")
        mediaUrl = intent.getStringExtra("mediaUrl")

        when (mediaType) {
            "image" -> showImagePreview()
            "video" -> showVideoPreview()
            "audio" -> showAudioPreview()
            else -> finish()
        }
    }

    // === IMAGE PREVIEW ===
    private fun showImagePreview() {
        imageView.visibility = View.VISIBLE
        playerView.visibility = View.GONE
        audioLayout.visibility = View.GONE

        Glide.with(this)
            .load(mediaUrl)
            .placeholder(R.drawable.placeholder_image)
            .error(R.drawable.error_image)
            .into(imageView)

        imageView.setOnClickListener { finish() }
    }

    // === VIDEO PREVIEW (Media3) ===
    private fun showVideoPreview() {
        imageView.visibility = View.GONE
        playerView.visibility = View.VISIBLE
        audioLayout.visibility = View.GONE

        playerView.bindVideo(
            mediaUrl = mediaUrl,
            autoplay = true,
            muted = false
        )
    }

    // === AUDIO PREVIEW (Media3) ===
    private fun showAudioPreview() {
        imageView.visibility = View.GONE
        playerView.visibility = View.GONE
        audioLayout.visibility = View.VISIBLE

        player = ExoPlayer.Builder(this).build().apply {
            setMediaItem(MediaItem.fromUri(mediaUrl!!))
            prepare()
            playWhenReady = false
        }

        // update timer and seekbar manually
        val handler = android.os.Handler(mainLooper)
        val updateSeek = object : Runnable {
            override fun run() {
                player?.let {
                    if (it.isPlaying) {
                        val pos = it.currentPosition.toInt()
                        val dur = it.duration.toInt().coerceAtLeast(1)
                        seekBar.progress = pos
                        txtTimer.text = getString(
                            R.string.media_time_with_total,
                            formatTime(pos),
                            formatTime(dur)
                        )
                        handler.postDelayed(this, 1000)
                    }
                }
            }
        }

        player?.addListener(object : androidx.media3.common.Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == androidx.media3.common.Player.STATE_READY && !isAudioPrepared) {
                    isAudioPrepared = true
                    seekBar.max = player?.duration?.toInt() ?: 0
                    txtTimer.text = getString(
                        R.string.media_time_with_total,
                        getString(R.string.time_zero),
                        formatTime(player?.duration?.toInt() ?: 0)
                    )
                }
            }
        })

        btnPlayAudio.setOnClickListener {
            player?.play()
            btnPlayAudio.visibility = View.GONE
            btnPauseAudio.visibility = View.VISIBLE
            handler.post(updateSeek)
        }

        btnPauseAudio.setOnClickListener {
            player?.pause()
            btnPlayAudio.visibility = View.VISIBLE
            btnPauseAudio.visibility = View.GONE
        }

        seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) player?.seekTo(progress.toLong())
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })
    }

    private fun formatTime(ms: Int): String {
        val seconds = (ms / 1000) % 60
        val minutes = (ms / 1000) / 60
        return getString(R.string.time_minutes_seconds_format, minutes, seconds)
    }

    override fun onStop() {
        super.onStop()
        player?.pause()
        if (::playerView.isInitialized) playerView.pause()
    }

    override fun onDestroy() {
        if (::playerView.isInitialized) playerView.release()
        player?.release()
        player = null
        super.onDestroy()
    }
}
