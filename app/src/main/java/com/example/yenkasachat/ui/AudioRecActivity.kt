package com.example.yenkasachat.ui

import android.Manifest
import android.app.Activity
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
import com.example.yenkasachat.R
import java.io.File
import java.text.SimpleDateFormat
import androidx.core.content.FileProvider
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
    }

    private fun startRecording() {
        if (isRecording) {
            Toast.makeText(this, "Already recording", Toast.LENGTH_SHORT).show()
            return
        }

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1001)
            return
        }

        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val audioFile = File(getExternalFilesDir(Environment.DIRECTORY_MUSIC), "AUDIO_$timestamp.3gp")
        audioFilePath = audioFile.absolutePath

        mediaRecorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
            setOutputFile(audioFilePath)
            setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
            prepare()
            start()
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
        btnPlayPause.isEnabled = true
        btnDelete.isEnabled = true

        Toast.makeText(this, "🎙️ Recording started", Toast.LENGTH_SHORT).show()
    }

    private fun stopRecording() {
        if (isRecording) {
            try {
                mediaRecorder?.stop()
            } catch (_: Exception) {}
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            isPaused = false

            timerHandler.removeCallbacks(updateTimer)

            btnStart.visibility = View.VISIBLE
            btnStop.visibility = View.GONE

            btnPlayPause.setImageResource(R.drawable.ic_play)
            btnSend.isEnabled = true
            btnPlayPause.isEnabled = true
            btnDelete.isEnabled = true

            Toast.makeText(this, "✅ Recording stopped", Toast.LENGTH_SHORT).show()
        }
    }

    private fun playPauseAudio() {
        if (audioFilePath.isEmpty()) return

        if (isRecording && !isPaused) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.pause()
                isPaused = true
                timerHandler.removeCallbacks(updateTimer)
                btnPlayPause.setImageResource(R.drawable.ic_play)
                btnSend.isEnabled = true
                Toast.makeText(this, "⏸️ Paused", Toast.LENGTH_SHORT).show()
            }
        } else if (isRecording && isPaused) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                mediaRecorder?.resume()
                isPaused = false
                startTime = SystemClock.elapsedRealtime()
                timerHandler.post(updateTimer)
                btnPlayPause.setImageResource(R.drawable.ic_pause)
                btnSend.isEnabled = false
                Toast.makeText(this, "▶️ Resumed", Toast.LENGTH_SHORT).show()
            }
        } else if (!isRecording) {
            // Playback mode
            if (isPlaying) {
                mediaPlayer?.pause()
                isPlaying = false
                btnPlayPause.setImageResource(R.drawable.ic_play)
            } else {
                mediaPlayer?.release()
                mediaPlayer = MediaPlayer().apply {
                    setDataSource(audioFilePath)
                    prepare()
                    start()
                    setOnCompletionListener {
                        this@AudioRecActivity.isPlaying = false
                        btnPlayPause.setImageResource(R.drawable.ic_play)
                    }
                }
                isPlaying = true
                btnPlayPause.setImageResource(R.drawable.ic_pause)
            }
        }
    }
    private fun sendAudio() {
        if (audioFilePath.isNotEmpty()) {
            val audioFile = File(audioFilePath)

            if (audioFile.exists()) {
                val audioUri: Uri = FileProvider.getUriForFile(
                    this,
                    "${applicationContext.packageName}.provider", // should match provider in Manifest
                    audioFile
                )

                val resultIntent = Intent().apply {
                    putExtra("audio_uri", audioUri.toString())
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                setResult(Activity.RESULT_OK, resultIntent)
                finish()
            } else {
                Toast.makeText(this, "Audio file not found", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "No audio to send", Toast.LENGTH_SHORT).show()
        }
    }


    private fun deleteAudio() {
        if (audioFilePath.isNotEmpty()) {
            val file = File(audioFilePath)
            if (file.exists()) {
                file.delete()
                Toast.makeText(this, "🗑️ Audio deleted", Toast.LENGTH_SHORT).show()
            }
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isRecording) {
            try {
                mediaRecorder?.stop()
            } catch (_: Exception) {}
        }
        mediaRecorder?.release()
        mediaPlayer?.release()
        mediaRecorder = null
        mediaPlayer = null
        timerHandler.removeCallbacks(updateTimer)
    }
}
