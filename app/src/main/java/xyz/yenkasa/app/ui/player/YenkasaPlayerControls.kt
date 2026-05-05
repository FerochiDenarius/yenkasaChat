package xyz.yenkasa.app.ui.player

import android.view.View
import android.widget.ImageButton
import android.widget.SeekBar
import android.widget.TextView
import androidx.core.view.isVisible
import xyz.yenkasa.app.R

class YenkasaPlayerControls(root: View) {
    private val seekBar: SeekBar = root.findViewById(R.id.playerSeekBar)
    private val currentTime: TextView = root.findViewById(R.id.textPlayerCurrentTime)
    private val durationTime: TextView = root.findViewById(R.id.textPlayerDuration)
    private val buttonPrevious: ImageButton = root.findViewById(R.id.buttonPlayerPrevious)
    private val buttonPlayPause: ImageButton = root.findViewById(R.id.buttonPlayerPlayPause)
    private val buttonNext: ImageButton = root.findViewById(R.id.buttonPlayerNext)
    private val buttonMute: ImageButton = root.findViewById(R.id.buttonPlayerMute)
    private val controlsContainer: View = root.findViewById(R.id.layoutPlayerControls)

    fun setCallbacks(
        onPrevious: () -> Unit,
        onPlayPause: () -> Unit,
        onNext: () -> Unit,
        onMute: () -> Unit,
        onSeek: (Int) -> Unit
    ) {
        buttonPrevious.setOnClickListener { onPrevious() }
        buttonPlayPause.setOnClickListener { onPlayPause() }
        buttonNext.setOnClickListener { onNext() }
        buttonMute.setOnClickListener { onMute() }
        seekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) onSeek(progress)
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
            override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
        })
    }

    fun bindMediaType(mediaType: MediaType) {
        val playable = mediaType == MediaType.VIDEO || mediaType == MediaType.AUDIO
        controlsContainer.isVisible = true
        seekBar.isVisible = playable
        currentTime.isVisible = playable
        durationTime.isVisible = playable
        buttonPlayPause.isVisible = playable
        buttonMute.isVisible = playable
        buttonPrevious.isVisible = true
        buttonNext.isVisible = true
    }

    fun setPlaying(isPlaying: Boolean) {
        buttonPlayPause.setImageResource(
            if (isPlaying) R.drawable.ic_pause else R.drawable.ic_play
        )
    }

    fun setMuted(isMuted: Boolean) {
        buttonMute.setImageResource(
            if (isMuted) R.drawable.ic_volume_off else R.drawable.ic_volume_up
        )
    }

    fun setProgress(currentMs: Long, durationMs: Long) {
        if (durationMs <= 0) {
            seekBar.progress = 0
            currentTime.text = "00:00"
            durationTime.text = "00:00"
            return
        }
        seekBar.progress = ((currentMs * 1000L) / durationMs).toInt().coerceIn(0, 1000)
        currentTime.text = formatTime(currentMs)
        durationTime.text = formatTime(durationMs)
    }

    private fun formatTime(ms: Long): String {
        val totalSeconds = (ms / 1000L).coerceAtLeast(0L)
        val minutes = totalSeconds / 60L
        val seconds = totalSeconds % 60L
        return String.format("%02d:%02d", minutes, seconds)
    }
}
