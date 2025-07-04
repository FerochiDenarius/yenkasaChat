package com.example.yenkasachat.ui

import android.content.Intent
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
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

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var audioFilePath: String = ""
    private var isRecording = false
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

        timerHandler = Handler(Looper.getMainLooper())

        btnStart.setOnClickListener { startRecording() }
        btnStop.setOnClickListener { stopRecording() }
        btnPlayPause.setOnClickListener { playPauseAudio() }
        btnSend.setOnClickListener { sendAudio() }
        btnDelete.setOnClickListener { deleteAudio() }
    }

    private fun startRecording() {
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
        startTime = SystemClock.elapsedRealtime()
        timerHandler.post(updateTimer)
        Toast.makeText(this, "Recording started", Toast.LENGTH_SHORT).show()
    }

    private fun stopRecording() {
        if (isRecording) {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false
            timerHandler.removeCallbacks(updateTimer)
            Toast.makeText(this, "Recording stopped", Toast.LENGTH_SHORT).show()
        }
    }

    private fun playPauseAudio() {
        if (audioFilePath.isEmpty()) return

        if (isPlaying) {
            mediaPlayer?.pause()
            isPlaying = false
            btnPlayPause.setImageResource(android.R.drawable.ic_media_play)
        } else {
            mediaPlayer = MediaPlayer().apply {
                setDataSource(audioFilePath)
                prepare()
                start()
                setOnCompletionListener {
                    this@AudioRecActivity.isPlaying = false
                    btnPlayPause.setImageResource(android.R.drawable.ic_media_play)
                }
            }
            isPlaying = true
            btnPlayPause.setImageResource(android.R.drawable.ic_media_pause)
        }
    }

    private fun sendAudio() {
        if (audioFilePath.isNotEmpty()) {
            val resultIntent = Intent().apply {
                putExtra("audio_uri", Uri.fromFile(File(audioFilePath)).toString())
            }
            setResult(RESULT_OK, resultIntent)
            finish()
        }
    }

    private fun deleteAudio() {
        if (audioFilePath.isNotEmpty()) {
            File(audioFilePath).delete()
            Toast.makeText(this, "Audio deleted", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaRecorder?.release()
        mediaPlayer?.release()
    }
}
