package xyz.yenkasa.app.notifications

import android.content.Intent
import android.util.Log
import xyz.yenkasa.app.ui.IncomingCallActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class IncomingCallService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        try {
            val data = remoteMessage.data
            Log.d("IncomingCallService", "Received push data: $data")

            val type = data["type"]

            if (type == "call_invite") {
                val callerId = data["callerId"]
                val callerName = data["callerName"]
                val isVideo = data["isVideo"]?.toBoolean() ?: true
                val roomUrl = data["roomUrl"]
                val roomToken = data["roomToken"]

                // Launch your custom incoming call UI
                val intent = Intent(this, IncomingCallActivity::class.java).apply {
                    putExtra("CALLER_ID", callerId)
                    putExtra("CALLER_NAME", callerName)
                    putExtra("IS_VIDEO_CALL", isVideo)
                    putExtra("ROOM_URL", roomUrl)
                    putExtra("ROOM_TOKEN", roomToken)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }

                startActivity(intent)
                Log.d("IncomingCallService", "IncomingCallActivity launched for caller: $callerName")
            } else {
                Log.d("IncomingCallService", "Non-call notification received, ignoring custom UI.")
            }

        } catch (e: Exception) {
            Log.e("IncomingCallService", "Error handling FCM message: ${e.message}", e)
        }
    }

    override fun onNewToken(token: String) {
        Log.d("IncomingCallService", "FCM token refreshed: $token")
        // You can send this token to your backend or Pusher Beams if needed
    }
}
