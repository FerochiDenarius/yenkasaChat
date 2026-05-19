package xyz.yenkasa.app.notifications

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject
import xyz.yenkasa.app.ui.CallNotificationHandler
import xyz.yenkasa.app.util.CallPayloadUtils

class IncomingCallService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        try {
            val data = remoteMessage.data
            Log.d("IncomingCallService", "Received push data: $data")

            val type = data["type"]

            if (type == "call_invite") {
                if (CallPayloadUtils.isDataCall(data)) {
                    Log.d("IncomingCallService", "Data-call push received; not launching video/audio call UI.")
                    return
                }

                CallNotificationHandler.showIncomingCall(this, JSONObject(data))
                Log.d("IncomingCallService", "Incoming call notification posted for caller: ${data["callerName"]}")
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
