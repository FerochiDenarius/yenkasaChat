package com.example.yenkasachat.webrtc

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.os.Build
import android.os.Bundle
import android.content.Intent
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.example.yenkasachat.R
import com.example.yenkasachat.model.GenerateTokenRequest
import com.example.yenkasachat.model.CreateRoomRequest
import com.example.yenkasachat.network.DailyApiClient
import com.example.yenkasachat.util.TokenManager
import com.example.yenkasachat.webrtc.WebSocketProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class VideoCallActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var btnEndCall: ImageButton
    private lateinit var tvCallStatus: TextView

    private val webSocketManager = WebSocketProvider.instance

    private var currentUserId: String? = null
    private var receiverId: String? = null
    private var receiverName: String? = null
    private var isCaller: Boolean = false
    private var isVideoCall: Boolean = true
    private var callAccepted = false

    // WebView / JS programmatic join state
    private var pageLoaded = false
    private var pendingJoinUrl: String? = null
    private var pendingJoinToken: String? = null
    private var pendingJoinUserName: String? = null

    private var ringtonePlayer: MediaPlayer? = null

    companion object {
        private const val TAG = "VideoCallActivity"
        private const val CAMERA_PERMISSION_REQUEST_CODE = 101
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )

        // HTML for Daily.co programmatic join
        private const val DAILY_HTML = """
            <!doctype html>
            <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1"/>
              <style>
                html, body, #container { height: 100%; margin: 0; padding: 0; background: #000; }
                #container { width: 100%; height: 100%; }
              </style>
              <script src="https://unpkg.com/@daily-co/daily-js"></script>
            </head>
            <body>
              <div id="container"></div>
              <script>
                window.callFrame = null;

                function joinRoom(roomUrl, token, userName) {
                  try {
                    if (window.callFrame) {
                      try {
                        window.callFrame.join({ url: roomUrl, token: token, userName: userName });
                        return;
                      } catch (e) {
                        console.warn('Reusing callFrame failed, recreating...', e);
                      }
                    }

                    const container = document.getElementById('container');
                    const df = window.DailyIframe.createFrame(container, {
                      showLeaveButton: true,
                      showFullscreenButton: true,
                      width: '100%',
                      height: '100%',
                    });
                    window.callFrame = df;

                    df.on('joined-meeting', () => console.log('DAILY: joined-meeting'));
                    df.on('left-meeting', () => {
                      console.log('DAILY: left-meeting');
                      if (window.AndroidBridge && window.AndroidBridge.onLeftMeeting) {
                        window.AndroidBridge.onLeftMeeting();
                      }
                    });
                    df.on('error', (err) => {
                      console.error('DAILY ERROR', err);
                      if (window.AndroidBridge && window.AndroidBridge.onDailyError) {
                        window.AndroidBridge.onDailyError(err.message || 'Unknown error');
                      }
                    });

                    df.join({ url: roomUrl, token: token, userName: userName });
                  } catch (err) {
                    console.error('joinRoom() failed', err);
                    if (window.AndroidBridge && window.AndroidBridge.onDailyError) {
                      window.AndroidBridge.onDailyError(err.message || 'Join failed');
                    }
                  }
                }

                function pageReady() {
                  if (window.AndroidBridge && window.AndroidBridge.pageReady) {
                    window.AndroidBridge.pageReady();
                  }
                }

                window.addEventListener('load', function(){
                  console.log('DAILY HTML loaded');
                  pageReady();
                });
              </script>
            </body>
            </html>
        """
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_video_call)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webview_call)
        btnEndCall = findViewById(R.id.btn_end_call)
        tvCallStatus = findViewById(R.id.tv_call_status)

        setupWebView()

        currentUserId = intent.getStringExtra("CURRENT_USER_ID")
        receiverId = intent.getStringExtra("RECEIVER_ID")
        receiverName = intent.getStringExtra("RECEIVER_NAME")
        isCaller = intent.getBooleanExtra("IS_CALLER", false)
        isVideoCall = intent.getBooleanExtra("IS_VIDEO_CALL", true)

        if (currentUserId.isNullOrBlank() || receiverId.isNullOrBlank()) {
            Toast.makeText(this, "Missing user IDs", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        tvCallStatus.text = when {
            isCaller && !receiverName.isNullOrBlank() -> "Calling $receiverName..."
            isCaller -> "Calling..."
            isVideoCall -> "Incoming video call..."
            else -> "Incoming audio call..."
        }

        webSocketManager.connect(this)

        btnEndCall.setOnClickListener {
            sendCallRejectedIfNeeded()
            endCall()
        }

        // Load the HTML early; JS will notify pageReady()
        webView.loadDataWithBaseURL("https://daily.co", DAILY_HTML, "text/html", "utf-8", null)
        webView.postDelayed({
            if (!pageLoaded) {
                Log.w(TAG, "⚠️ Fallback join trigger — forcing flushPendingJoinIfAny()")
                flushPendingJoinIfAny()
            }
        }, 2000)

        if (!allPermissionsGranted()) {
            ActivityCompat.requestPermissions(this, REQUIRED_PERMISSIONS, CAMERA_PERMISSION_REQUEST_CODE)
        } else {
            listenForSignalingMessages()
            if (isCaller) startOutgoingCall()
        }



        // Auto-join if room data already present
        intent.getStringExtra("ROOM_URL")?.let { url ->
            intent.getStringExtra("ROOM_TOKEN")?.let { token ->
                val userName = TokenManager.getUsername(this) ?: currentUserId ?: "Participant"
                requestJoin(url, token, userName)
            }
        }
    }

    private fun setupWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowContentAccess = true
        webView.settings.domStorageEnabled = true

        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun pageReady() {
                runOnUiThread {
                    Log.i(TAG, "JS → pageReady()")
                    pageLoaded = true
                    flushPendingJoinIfAny()
                }
            }

            @JavascriptInterface
            fun onLeftMeeting() {
                runOnUiThread {
                    Log.i(TAG, "JS → onLeftMeeting()")
                    endCall()
                }
            }

            @JavascriptInterface
            fun onDailyError(message: String) {
                runOnUiThread {
                    Log.e(TAG, "JS → onDailyError: $message")
                    showToast("Call error: $message")
                }
            }
        }, "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.d(TAG, "WebView loaded: $url")
                pageLoaded = true
                flushPendingJoinIfAny()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        try {
                            request.grant(request.resources)
                            Log.d(TAG, "Granted WebView permissions for: ${request.resources.joinToString()}")
                        } catch (e: Exception) {
                            Log.e(TAG, "Permission grant failed: ${e.message}")
                        }
                    }
                }
            }
        }
    }

    private fun allPermissionsGranted(): Boolean =
        REQUIRED_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE && allPermissionsGranted()) {
            listenForSignalingMessages()
            if (isCaller) startOutgoingCall()
        } else {
            Toast.makeText(this, "Camera & Mic permissions required", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    // -------------------- CALL FLOW --------------------

    private fun startOutgoingCall() {
        tvCallStatus.visibility = View.VISIBLE
        playOutgoingRingtone()

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val roomName = if (currentUserId!! < receiverId!!) {
                    "call_${currentUserId}_$receiverId"
                } else {
                    "call_${receiverId}_$currentUserId"
                }

                val createRes = DailyApiClient.service.createRoom(CreateRoomRequest(roomName)).execute()
                val room = createRes.body() ?: run {
                    showToast("Failed to create room")
                    return@launch
                }

                val tokenRes = DailyApiClient.service.generateToken(
                    GenerateTokenRequest(room.roomName, currentUserId!!)
                ).execute()
                val token = tokenRes.body()?.token ?: run {
                    showToast("Failed to generate token")
                    return@launch
                }

                Log.i(TAG, "Sending call_request with room info to $receiverId")
                webSocketManager.sendCallRequest(receiverId!!, isVideoCall, room.roomUrl, token)

                val userName = TokenManager.getUsername(this@VideoCallActivity) ?: currentUserId ?: "Caller"
                withContext(Dispatchers.Main) {
                    requestJoin(room.roomUrl, token, userName)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error creating room in startOutgoingCall: ${e.message}", e)
                showToast("Error creating room: ${e.message}")
            }
        }
    }

    private fun listenForSignalingMessages() {
        lifecycleScope.launch {
            webSocketManager.signalingMessages.collect { msg ->
                Log.d(TAG, "Signaling: ${msg.type} from ${msg.fromUserId}")

                when (msg.type) {

                    // 📞 Incoming call request (Receiver side)
                    SignalingMessageType.CALL_REQUEST -> {
                        if (!isCaller) {
                            val callerId = msg.fromUserId ?: return@collect
                            val callerName = msg.callerName ?: "Unknown"
                            val isVideo = msg.isVideo ?: true
                            val roomUrl = msg.roomUrl
                            val token = msg.token

                            if (roomUrl.isNullOrEmpty() || token.isNullOrEmpty()) {
                                Log.e(TAG, "❌ Missing room info in CALL_REQUEST — cannot show accept screen")
                                return@collect
                            }

                            Log.i(TAG, "📞 Incoming call from $callerName ($callerId)")

                            val intent = Intent(this@VideoCallActivity,
                                com.example.yenkasachat.ui.IncomingCallActivity::class.java
                            ).apply {
                                putExtra("CALLER_ID", callerId)
                                putExtra("CALLER_NAME", callerName)
                                putExtra("IS_VIDEO_CALL", isVideo)
                                putExtra("ROOM_URL", roomUrl)
                                putExtra("ROOM_TOKEN", token)
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)

                            }
                            startActivity(intent)
                        }
                    }

                    // ✅ Receiver accepted — caller sends CALL_ACCEPT_WITH_ROOM back
                    SignalingMessageType.CALL_ACCEPT -> if (isCaller) {
                        Log.i(TAG, "Receiver accepted — sending CALL_ACCEPT_WITH_ROOM")
                        stopRingtone()
                        callAccepted = true
                        handleCallAcceptForCaller()
                    }

                    // ✅ Receiver joins directly if caller sends CALL_ACCEPT_WITH_ROOM
                    SignalingMessageType.CALL_ACCEPT_WITH_ROOM -> if (!isCaller) {
                        stopRingtone()
                        callAccepted = true
                        val roomUrl = msg.roomUrl
                        val token = msg.token
                        if (!roomUrl.isNullOrEmpty() && !token.isNullOrEmpty()) {
                            val userName = TokenManager.getUsername(this@VideoCallActivity)
                                ?: currentUserId ?: "Participant"
                            requestJoin(roomUrl, token, userName)
                        } else {
                            showToast("Invalid room info")
                        }
                    }

                    // 🚫 Call rejected
                    SignalingMessageType.CALL_REJECT -> {
                        stopRingtone()
                        onCallRejected()
                    }

                    else -> Unit
                }
            }
        }
    }

    private fun handleCallAcceptForCaller() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val roomName = if (currentUserId!! < receiverId!!) {
                    "call_${currentUserId}_$receiverId"
                } else {
                    "call_${receiverId}_$currentUserId"
                }

                val createRes = DailyApiClient.service.createRoom(CreateRoomRequest(roomName)).execute()
                val room = createRes.body() ?: run {
                    showToast("Failed to create room")
                    return@launch
                }

                val tokenRes = DailyApiClient.service.generateToken(
                    GenerateTokenRequest(room.roomName, currentUserId!!)
                ).execute()
                val token = tokenRes.body()?.token ?: run {
                    showToast("Failed to generate token")
                    return@launch
                }

                // ✅ Send CALL_ACCEPT_WITH_ROOM so receiver can join
                webSocketManager.sendCallAcceptWithRoom(receiverId!!, room.roomUrl, token)

                // ✅ Caller auto-joins room
                val userName = TokenManager.getUsername(this@VideoCallActivity) ?: currentUserId ?: "Caller"
                withContext(Dispatchers.Main) {
                    runOnUiThread {
                        requestJoin(room.roomUrl, token, userName)
                    }
                }


            } catch (e: Exception) {
                Log.e(TAG, "handleCallAcceptForCaller failed: ${e.message}", e)
                showToast("Error: ${e.message}")
            }
        }
    }

    // -------------------- JS JOIN --------------------

    private fun requestJoin(roomUrl: String, token: String, userName: String) {
        pendingJoinUrl = roomUrl
        pendingJoinToken = token
        pendingJoinUserName = userName
        flushPendingJoinIfAny()
    }

    private fun flushPendingJoinIfAny() {
        if (!pageLoaded) {
            Log.d(TAG, "Page not loaded yet; will join when ready")
            return
        }

        val url = pendingJoinUrl ?: return
        val tkn = pendingJoinToken ?: return
        val user = pendingJoinUserName ?: (TokenManager.getUsername(this) ?: currentUserId ?: "User")

        // Use JSONObject.quote to safely escape JS strings
        val jsRoom = JSONObject.quote(url)
        val jsToken = JSONObject.quote(tkn)
        val jsUser = JSONObject.quote(user)

        val js = "try{ joinRoom($jsRoom, $jsToken, $jsUser); }catch(e){ console.error('joinRoom invocation failed', e); }"
        Log.i(TAG, "Invoking JS joinRoom(...) on main thread")

        // ✅ Run the WebView call on the UI thread to avoid threading crash
        runOnUiThread {
            try {
                webView.evaluateJavascript(js, null)
            } catch (e: Exception) {
                Log.e(TAG, "Error running JS joinRoom on WebView: ${e.message}", e)
            }
        }

        // Clear pending so we don't re-run
        pendingJoinUrl = null
        pendingJoinToken = null
        pendingJoinUserName = null
        tvCallStatus.visibility = View.GONE
    }

    // -------------------- UI / AUDIO --------------------

    private fun playOutgoingRingtone() {
        stopRingtone()
        ringtonePlayer = MediaPlayer.create(this, R.raw.outgoing_call)?.apply {
            isLooping = true; start()
        }
    }

    private fun playIncomingRingtone() {
        stopRingtone()
        ringtonePlayer = MediaPlayer.create(this, R.raw.incoming_call)?.apply {
            isLooping = true; start()
        }
    }

    private fun stopRingtone() {
        try { ringtonePlayer?.let { if (it.isPlaying) it.stop(); it.release() } }
        catch (e: Exception) { Log.w(TAG, "stopRingtone error: ${e.message}") }
        finally { ringtonePlayer = null }
    }

    private fun onCallRejected() {
        runOnUiThread {
            Toast.makeText(this, "Call rejected.", Toast.LENGTH_SHORT).show()
            endCall()
        }
    }

    private fun sendCallRejectedIfNeeded() {}

    private fun endCall() {
        Log.i(TAG, "Ending call")
        stopRingtone()
        try { webView.loadUrl("about:blank") } catch (_: Exception) {}
        finish()
    }

    private fun showToast(message: String) =
        runOnUiThread { Toast.makeText(this, message, Toast.LENGTH_SHORT).show() }

    override fun onDestroy() {
        super.onDestroy()
        stopRingtone()
        webSocketManager.disconnect() // 👈 add this line
        try {
            webView.apply {
                loadUrl("about:blank")
                clearHistory()
                removeAllViews()
                destroy()
            }
        } catch (e: Exception) {
            Log.w(TAG, "WebView cleanup failed: ${e.message}")
        }
    }
}
