package xyz.yenkasa.app.ui

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.*
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.FileProvider
import xyz.yenkasa.app.R
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class AudioRecActivity : AppCompatActivity() {

    private lateinit var btnStart: ImageButton
    private lateinit var btnStop: ImageButton
    private lateinit var btnPlayPause: ImageButton
    private lateinit var btnSend: ImageButton
    private lateinit var btnDelete: ImageButton
    private lateinit var timerText: TextView
    private lateinit var previewControls: LinearLayout

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var audioFilePath: String = ""
    private var isRecording = false
    private var isPaused = false
    private var isPlaying = false

    private lateinit var timerHandler: Handler
    private var startTime = 0L

    private val updateTimer = object : Runnable {
        override fun run() {
            val elapsed = SystemClock.elapsedRealtime() - startTime
            val seconds = (elapsed / 1000) % 60
            val minutes = (elapsed / 1000) / 60
            timerText.text = String.format("%02d:%02d", minutes, seconds)
            timerHandler.postDelayed(this, 1000)
        }
    }

    companion object {
        private const val RECORD_REQUEST_CODE = 1001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_audio_rec)

        btnStart = findViewById(R.id.btnStartRecording)
        btnStop = findViewById(R.id.btnStopRecording)
        btnPlayPause = findViewById(R.id.btnPlayPausePreview)
        btnSend = findViewById(R.id.btnSendAudioFile)
        btnDelete = findViewById(R.id.btnDeleteAudio)
        timerText = findViewById(R.id.recordingTimer)
        previewControls = findViewById(R.id.previewControls)

        timerHandler = Handler(Looper.getMainLooper())

        btnStart.setOnClickListener { startRecording() }
        btnStop.setOnClickListener { stopRecording() }
        btnPlayPause.setOnClickListener { playPauseAudio() }
        btnSend.setOnClickListener { sendAudio() }
        btnDelete.setOnClickListener { deleteAudio() }

        btnStop.visibility = View.GONE
        previewControls.visibility = View.GONE
        timerText.visibility = View.GONE

        btnSend.isEnabled = false
        btnPlayPause.isEnabled = false
        btnDelete.isEnabled = false
    }

    private fun startRecording() {
        if (isRecording) {
            Toast.makeText(this, R.string.audio_already_recording, Toast.LENGTH_SHORT).show()
            return
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), RECORD_REQUEST_CODE)
            return
        }

        // Use MPEG_4 + AAC for compatibility
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val audioFile = File(getExternalFilesDir(Environment.DIRECTORY_MUSIC), "AUDIO_$timestamp.m4a")
        audioFilePath = audioFile.absolutePath

        try {
            mediaRecorder?.release()
            mediaRecorder = MediaRecorder().apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128000)
                setAudioSamplingRate(44100)
                setOutputFile(audioFilePath)
                prepare()
                start()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(
                this,
                getString(
                    R.string.audio_recording_start_failed_with_error,
                    e.message ?: getString(R.string.unknown_error)
                ),
                Toast.LENGTH_LONG
            ).show()
            mediaRecorder?.release()
            mediaRecorder = null
            return
        }

        isRecording = true
        isPaused = false
        isPlaying = false
        startTime = SystemClock.elapsedRealtime()
        timerHandler.post(updateTimer)

        btnStart.visibility = View.GONE
        btnStop.visibility = View.VISIBLE
        previewControls.visibility = View.VISIBLE
        timerText.visibility = View.VISIBLE

        btnPlayPause.setImageResource(R.drawable.ic_pause)
        btnSend.isEnabled = false
        btnPlayPause.isEnabled = false // playback disabled while recording
        btnDelete.isEnabled = false

        Toast.makeText(this, R.string.audio_recording_started, Toast.LENGTH_SHORT).show()
    }

    private fun stopRecording() {
        if (!isRecording) return

        try {
            mediaRecorder?.stop()
        } catch (e: Exception) {
            // sometimes stop throws if recorder isn't in correct state; still attempt release below
            e.printStackTrace()
        }
        mediaRecorder?.release()
        mediaRecorder = null
        isRecording = false
        isPaused = false

        timerHandler.removeCallbacks(updateTimer)

        btnStart.visibility = View.VISIBLE
        btnStop.visibility = View.GONE

        // Enable preview controls now that we have a file
        previewControls.visibility = View.VISIBLE
        timerText.visibility = View.VISIBLE

        btnPlayPause.setImageResource(R.drawable.ic_play)
        btnSend.isEnabled = true
        btnPlayPause.isEnabled = true
        btnDelete.isEnabled = true

        Toast.makeText(this, R.string.audio_recording_stopped, Toast.LENGTH_SHORT).show()

        // Prepare MediaPlayer for immediate preview
        prepareMediaPlayerForPreview()
    }

    private fun prepareMediaPlayerForPreview() {
        // Release any previous player
        try {
            mediaPlayer?.release()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        mediaPlayer = null
        isPlaying = false

        if (audioFilePath.isEmpty()) return

        try {
            val audioFile = File(audioFilePath)
            if (!audioFile.exists()) {
                Toast.makeText(this, R.string.audio_recorded_file_not_found, Toast.LENGTH_SHORT).show()
                return
            }

            mediaPlayer = MediaPlayer().apply {
                setDataSource(audioFile.absolutePath)
                prepare() // small file — sync prepare is fine here
                setOnCompletionListener {
                    this@AudioRecActivity.isPlaying = false
                    btnPlayPause.setImageResource(R.drawable.ic_play)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(
                this,
                getString(
                    R.string.audio_prepare_player_failed_with_error,
                    e.message ?: getString(R.string.unknown_error)
                ),
                Toast.LENGTH_LONG
            ).show()
            mediaPlayer?.release()
            mediaPlayer = null
        }
    }

    private fun playPauseAudio() {

        if (isRecording) {
            Toast.makeText(
                this,
                R.string.audio_stop_recording_before_playback,
                Toast.LENGTH_SHORT
            ).show()
            return
        }

        if (audioFilePath.isEmpty()) {
            Toast.makeText(this, R.string.audio_no_audio_to_play, Toast.LENGTH_SHORT).show()
            return
        }

        val player = mediaPlayer
        if (player == null) {
            // try to prepare if not prepared
            prepareMediaPlayerForPreview()
        }

        // Toggle play/pause
        mediaPlayer?.let {
            if (it.isPlaying) {
                it.pause()
                isPlaying = false
                btnPlayPause.setImageResource(R.drawable.ic_play)
            } else {
                try {
                    it.start()
                    isPlaying = true
                    btnPlayPause.setImageResource(R.drawable.ic_pause)
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(
                        this,
                        getString(
                            R.string.audio_playback_error_with_message,
                            e.message ?: getString(R.string.unknown_error)
                        ),
                        Toast.LENGTH_SHORT
                    ).show()
                    // attempt re-prep
                    prepareMediaPlayerForPreview()
                }
            }
        }
    }

    private fun sendAudio() {
        if (audioFilePath.isEmpty()) {
            Toast.makeText(this, R.string.audio_no_audio_to_send, Toast.LENGTH_SHORT).show()
            return
        }

        val audioFile = File(audioFilePath)
        if (!audioFile.exists()) {
            Toast.makeText(this, R.string.audio_file_not_found, Toast.LENGTH_SHORT).show()
            return
        }

        try {
            val audioUri: Uri = FileProvider.getUriForFile(
                this,
                "${applicationContext.packageName}.provider",
                audioFile
            )

            val resultIntent = Intent().apply {
                putExtra("audio_uri", audioUri.toString())
                // use the setter to avoid "val cannot be reassigned" on some platforms
                setClipData(ClipData.newUri(contentResolver, "audio", audioUri))
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            // For safety, grant URI permission to all packages that can receive this intent (same app)
            grantUriPermission(packageName, audioUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)

            setResult(Activity.RESULT_OK, resultIntent)
            finish()
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(
                this,
                getString(
                    R.string.audio_send_failed_with_error,
                    e.message ?: getString(R.string.unknown_error)
                ),
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun deleteAudio() {
        if (audioFilePath.isNotEmpty()) {
            val file = File(audioFilePath)
            if (file.exists()) {
                val deleted = file.delete()
                if (deleted) {
                    Toast.makeText(this, R.string.audio_deleted, Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, R.string.audio_delete_failed, Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, R.string.audio_file_not_present, Toast.LENGTH_SHORT).show()
            }
            audioFilePath = ""
        }
        finish()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RECORD_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startRecording()
            } else {
                Toast.makeText(this, R.string.microphone_permission_required, Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            if (isRecording) {
                try { mediaRecorder?.stop() } catch (_: Exception) {}
            }
        } catch (_: Exception) {}

        try {
            mediaRecorder?.release()
        } catch (_: Exception) {}
        mediaRecorder = null

        try {
            mediaPlayer?.release()
        } catch (_: Exception) {}
        mediaPlayer = null

        timerHandler.removeCallbacks(updateTimer)
    }
}
