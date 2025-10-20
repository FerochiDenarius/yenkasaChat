package com.example.yenkasachat.ui

import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.util.Log
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.webrtc.VideoCallActivity
import com.example.yenkasachat.webrtc.WebSocketManager
import com.example.yenkasachat.webrtc.WebSocketProvider

class IncomingCallActivity : AppCompatActivity() {

    private lateinit var webSocketManager: WebSocketManager
    private var ringtone: MediaPlayer? = null
    private var callerId: String? = null
    private var callerName: String? = null
    private var isVideo: Boolean = true
    private var roomUrl: String? = null
    private var roomToken: String? = null

    companion object {
        private const val TAG = "IncomingCallAct"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_incoming_call)

        webSocketManager = WebSocketProvider.instance

        callerId = intent.getStringExtra("CALLER_ID")
        callerName = intent.getStringExtra("CALLER_NAME")
        isVideo = intent.getBooleanExtra("IS_VIDEO_CALL", true)
        roomUrl = intent.getStringExtra("ROOM_URL")   // ✅ now passed with the call request
        roomToken = intent.getStringExtra("ROOM_TOKEN")

        findViewById<TextView>(R.id.textCallerName).text = callerName ?: "Unknown"
        findViewById<TextView>(R.id.textCallType).text = if (isVideo) "Video Call" else "Audio Call"

        playIncomingTone()

        findViewById<ImageButton>(R.id.btnAcceptCall).setOnClickListener {
            if (callerId == null || roomUrl.isNullOrEmpty() || roomToken.isNullOrEmpty()) {
                Toast.makeText(this, "Missing call info", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            acceptCall()
        }

        findViewById<ImageButton>(R.id.btnRejectCall).setOnClickListener {
            rejectCall()
        }
    }

    /**
     * Accept the incoming call and immediately join the shared room.
     */
    private fun acceptCall() {
        stopRingtone()

        val caller = callerId ?: return
        val url = roomUrl ?: return
        val token = roomToken ?: return
        val userName = TokenManager.getUsername(this) ?: "Receiver"

        Log.i(TAG, "Accepting call from $caller — joining room $url")

        // Send simple ACK (so caller can update UI if needed)
        webSocketManager.sendCallAccept(caller)

        Toast.makeText(this, "Connecting to call...", Toast.LENGTH_SHORT).show()

        // Launch call activity using the same room info
        val intent = Intent(this, VideoCallActivity::class.java).apply {
            putExtra("CURRENT_USER_ID", TokenManager.getUserId(this@IncomingCallActivity))
            putExtra("RECEIVER_ID", caller)
            putExtra("RECEIVER_NAME", callerName)
            putExtra("IS_CALLER", false)
            putExtra("IS_VIDEO_CALL", isVideo)
            putExtra("ROOM_URL", url)
            putExtra("ROOM_TOKEN", token)
        }
        startActivity(intent)
        finish()
    }

    /**
     * Reject the call and notify the caller.
     */
    private fun rejectCall() {
        stopRingtone()
        callerId?.let { webSocketManager.sendCallReject(it) }
        finish()
    }

    /**
     * Play looping incoming call ringtone.
     */
    private fun playIncomingTone() {
        try {
            ringtone = MediaPlayer.create(this, R.raw.incoming_call).apply {
                isLooping = true
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error playing ringtone: ${e.message}")
        }
    }

    /**
     * Stop ringtone safely.
     */
    private fun stopRingtone() {
        try {
            ringtone?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping ringtone: ${e.message}")
        } finally {
            ringtone = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtone()
    }
}
