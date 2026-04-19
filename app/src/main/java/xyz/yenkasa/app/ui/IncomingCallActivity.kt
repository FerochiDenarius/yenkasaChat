package xyz.yenkasa.app.ui

import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.util.CallPayloadUtils
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.webrtc.VideoCallActivity
import xyz.yenkasa.app.webrtc.WebSocketManager
import xyz.yenkasa.app.webrtc.WebSocketProvider

class IncomingCallActivity : AppCompatActivity() {

    private lateinit var webSocketManager: WebSocketManager
    private var ringtone: MediaPlayer? = null
    private var callerId: String? = null
    private var callerName: String? = null
    private var isVideo: Boolean = true
    private var callType: String = "video"
    private var roomUrl: String? = null
    private var roomToken: String? = null

    companion object {
        private const val TAG = "IncomingCallAct"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ✅ Make sure screen turns on and shows even if device is locked
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        setContentView(R.layout.activity_incoming_call)

        webSocketManager = WebSocketProvider.instance

        callerId = intent.getStringExtra("CALLER_ID")
        callerName = intent.getStringExtra("CALLER_NAME")
        isVideo = intent.getBooleanExtra("IS_VIDEO_CALL", true)
        callType = intent.getStringExtra("CALL_TYPE") ?: if (isVideo) "video" else "audio"
        roomUrl = intent.getStringExtra("ROOM_URL")
        roomToken = intent.getStringExtra("ROOM_TOKEN")

        if (CallPayloadUtils.isDataCall(type = null, targetType = null, callType = callType)) {
            Log.d(TAG, "Data-call intent received; closing incoming video/audio call screen.")
            finish()
            return
        }

        findViewById<TextView>(R.id.textCallerName).text = callerName ?: "Unknown"
        findViewById<TextView>(R.id.textCallType).text =
            if (isVideo) "Video Call" else "Audio Call"

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

    override fun onStart() {
        super.onStart()
        webSocketManager.connect(this)
    }

    override fun onStop() {
        webSocketManager.release(this)
        super.onStop()
    }

    /**
     * Accept the incoming call and immediately join the shared room.
     */
    private fun acceptCall() {
        if (CallPayloadUtils.isDataCall(type = null, targetType = null, callType = callType)) {
            Log.d(TAG, "Ignoring accept for data-call payload.")
            finish()
            return
        }

        stopRingtone()

        val caller = callerId ?: return
        val url = roomUrl ?: return
        val token = roomToken ?: return
        val userName = TokenManager.getUsername(this) ?: "Receiver"

        Log.i(TAG, "✅ Accepting call from $caller — joining room $url")

        // Notify caller that receiver accepted
        webSocketManager.sendCallAccept(caller)

        Toast.makeText(this, "Connecting to call...", Toast.LENGTH_SHORT).show()

        // Launch VideoCallActivity safely even if backgrounded
        val intent = Intent(this, VideoCallActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("CURRENT_USER_ID", TokenManager.getUserId(this@IncomingCallActivity))
            putExtra("RECEIVER_ID", caller)
            putExtra("RECEIVER_NAME", callerName)
            putExtra("IS_CALLER", false)
            putExtra("IS_VIDEO_CALL", isVideo)
            putExtra("CALL_TYPE", callType)
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
            stopRingtone() // Ensure no overlap
            ringtone = MediaPlayer.create(this, R.raw.incoming_call)?.apply {
                isLooping = true
                start()
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error playing ringtone: ${e.message}")
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
            Log.w(TAG, "⚠️ Error stopping ringtone: ${e.message}")
        } finally {
            ringtone = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtone()
    }
}
