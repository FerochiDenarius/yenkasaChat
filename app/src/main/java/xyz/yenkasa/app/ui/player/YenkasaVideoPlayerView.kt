package xyz.yenkasa.app.ui.player

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
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
import xyz.yenkasa.app.util.CloudinaryMedia
import xyz.yenkasa.app.util.YenkasaMediaCache

class YenkasaVideoPlayerView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : FrameLayout(context, attrs) {

    private val surface: PlayerView
    private val poster: ImageView
    private val loading: ProgressBar
    private val centerPlay: ImageButton
    private val controls: View
    private val bottomGradient: View
    private val playPause: ImageButton
    private val mute: ImageButton
    private val progress: ProgressBar
    private val errorText: TextView

    private var player: ExoPlayer? = null
    private var mediaUrl: String? = null
    private var posterUrl: String? = null
    private var muted = true
    private var autoplay = false
    private var loop = false
    private var controlsVisible = true
    private var checkpoints: Set<Int> = setOf(5, 10, 30)
    private val firedCheckpoints = mutableSetOf<Int>()
    private var checkpointListener: ((Int) -> Unit)? = null
    private var readyListener: (() -> Unit)? = null
    private var completionListener: (() -> Unit)? = null
    private var errorListener: ((PlaybackException) -> Unit)? = null
    private val handler = Handler(Looper.getMainLooper())

    private val hideControlsRunnable = Runnable {
        if (player?.isPlaying == true) {
            controlsVisible = false
            renderControls()
        }
    }

    private val progressRunnable = object : Runnable {
        override fun run() {
            val current = player ?: return
            val duration = current.duration
            if (duration > 0) {
                progress.progress = ((current.currentPosition * 1000L) / duration).toInt().coerceIn(0, 1000)
            }
            val second = (current.currentPosition / 1000L).toInt()
            if (second in checkpoints && firedCheckpoints.add(second)) {
                checkpointListener?.invoke(second)
            }
            if (current.isPlaying) {
                handler.postDelayed(this, 300L)
            }
        }
    }

    init {
        LayoutInflater.from(context).inflate(R.layout.view_yenkasa_video_player, this, true)
        surface = findViewById(R.id.yenkasaVideoSurface)
        poster = findViewById(R.id.yenkasaVideoPoster)
        loading = findViewById(R.id.yenkasaVideoLoading)
        centerPlay = findViewById(R.id.yenkasaVideoCenterPlay)
        controls = findViewById(R.id.yenkasaVideoControls)
        bottomGradient = findViewById(R.id.yenkasaVideoBottomGradient)
        playPause = findViewById(R.id.yenkasaVideoPlayPause)
        mute = findViewById(R.id.yenkasaVideoMute)
        progress = findViewById(R.id.yenkasaVideoProgress)
        errorText = findViewById(R.id.yenkasaVideoError)

        surface.useController = false
        setOnClickListener { toggleControls() }
        centerPlay.setOnClickListener { play() }
        playPause.setOnClickListener { togglePlayback() }
        mute.setOnClickListener { setMuted(!muted) }
        errorText.setOnClickListener { mediaUrl?.let { bindVideo(it, posterUrl, autoplay, muted, loop) } }
        resetViews()
    }

    fun bindVideo(
        mediaUrl: String?,
        thumbnailUrl: String? = null,
        autoplay: Boolean = false,
        muted: Boolean = true,
        loop: Boolean = false
    ) {
        release()
        this.mediaUrl = mediaUrl?.takeIf { it.isNotBlank() }
        this.posterUrl = thumbnailUrl?.takeIf { it.isNotBlank() }
        this.autoplay = autoplay
        this.muted = muted
        this.loop = loop
        firedCheckpoints.clear()
        resetViews()

        val url = this.mediaUrl
        if (url == null) {
            isVisible = false
            return
        }

        isVisible = true
        loadPoster(url)
        setMuted(muted)
        if (autoplay) {
            play()
        }
    }

    fun setCheckpointListener(listener: ((Int) -> Unit)?) {
        checkpointListener = listener
    }

    fun setReadyListener(listener: (() -> Unit)?) {
        readyListener = listener
    }

    fun setCompletionListener(listener: (() -> Unit)?) {
        completionListener = listener
    }

    fun setErrorListener(listener: ((PlaybackException) -> Unit)?) {
        errorListener = listener
    }

    fun play() {
        val url = mediaUrl ?: return
        pauseActiveVideo()
        activeView = this
        errorText.isVisible = false
        poster.isVisible = false
        centerPlay.isVisible = false
        surface.isVisible = true
        loading.isVisible = true
        controlsVisible = true
        renderControls()

        val currentPlayer = player ?: createPlayer(url).also { player = it }
        if (currentPlayer.playbackState == Player.STATE_IDLE) {
            currentPlayer.prepare()
        }
        currentPlayer.play()
        handler.removeCallbacks(progressRunnable)
        handler.post(progressRunnable)
        scheduleHideControls()
    }

    fun pause() {
        player?.pause()
        handler.removeCallbacks(progressRunnable)
        updatePlayPauseIcon()
        controlsVisible = true
        renderControls()
    }

    fun togglePlayback() {
        if (player?.isPlaying == true) {
            pause()
        } else {
            play()
        }
    }

    fun stopAndShowPoster() {
        player?.pause()
        handler.removeCallbacks(progressRunnable)
        loading.isVisible = false
        surface.isVisible = false
        poster.isVisible = true
        centerPlay.isVisible = mediaUrl != null
        controlsVisible = false
        renderControls()
        if (activeView === this) activeView = null
    }

    fun release() {
        if (activeView === this) activeView = null
        handler.removeCallbacksAndMessages(null)
        surface.player = null
        player?.release()
        player = null
    }

    fun isPlaying(): Boolean = player?.isPlaying == true

    fun setMuted(value: Boolean) {
        muted = value
        player?.volume = if (muted) 0f else 1f
        mute.setImageResource(if (muted) R.drawable.ic_volume_off else R.drawable.ic_volume_up)
    }

    private fun createPlayer(url: String): ExoPlayer {
        return ExoPlayer.Builder(context).build().also { exo ->
            exo.repeatMode = if (loop) Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
            exo.volume = if (muted) 0f else 1f
            exo.setMediaSource(YenkasaMediaCache.mediaSource(context, MediaItem.fromUri(Uri.parse(url))))
            exo.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    loading.isVisible = playbackState == Player.STATE_BUFFERING
                    if (playbackState == Player.STATE_READY) {
                        loading.isVisible = false
                        readyListener?.invoke()
                    }
                    if (playbackState == Player.STATE_ENDED) {
                        stopAndShowPoster()
                        progress.progress = 0
                        completionListener?.invoke()
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    updatePlayPauseIcon()
                    if (isPlaying) {
                        handler.post(progressRunnable)
                        scheduleHideControls()
                    } else {
                        controlsVisible = true
                        renderControls()
                    }
                }

                override fun onPlayerError(error: PlaybackException) {
                    Log.e("YenkasaVideoPlayer", "Video failed: $url", error)
                    loading.isVisible = false
                    errorText.isVisible = true
                    stopAndShowPoster()
                    errorListener?.invoke(error)
                }
            })
            surface.player = exo
        }
    }

    private fun loadPoster(url: String) {
        val candidate = posterUrl
            ?: CloudinaryMedia.videoPosterUrl(url, CloudinaryMedia.WIDTH_PREVIEW)
            ?: url
        poster.isVisible = true
        centerPlay.isVisible = true
        Glide.with(this)
            .load(candidate)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .placeholder(R.drawable.video_placeholder)
            .error(R.drawable.video_placeholder)
            .into(poster)
    }

    private fun resetViews() {
        surface.isVisible = false
        poster.isVisible = false
        loading.isVisible = false
        centerPlay.isVisible = false
        errorText.isVisible = false
        progress.progress = 0
        controlsVisible = false
        renderControls()
    }

    private fun toggleControls() {
        if (mediaUrl == null) return
        controlsVisible = !controlsVisible
        renderControls()
        if (controlsVisible) scheduleHideControls()
    }

    private fun renderControls() {
        val show = controlsVisible && mediaUrl != null
        controls.isVisible = show
        bottomGradient.isVisible = show
        updatePlayPauseIcon()
    }

    private fun updatePlayPauseIcon() {
        playPause.setImageResource(if (player?.isPlaying == true) R.drawable.ic_pause else R.drawable.ic_play_arrow)
    }

    private fun scheduleHideControls() {
        handler.removeCallbacks(hideControlsRunnable)
        handler.postDelayed(hideControlsRunnable, 2500L)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
    }

    companion object {
        private var activeView: YenkasaVideoPlayerView? = null

        fun pauseActiveVideo() {
            activeView?.pause()
        }
    }
}
