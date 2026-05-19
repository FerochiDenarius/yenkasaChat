package xyz.yenkasa.app.ui.chat

import android.Manifest
import android.content.Intent
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.util.TokenManager
import xyz.yenkasa.app.webrtc.VideoCallActivity

class ChatCallController(
    private val activity: AppCompatActivity,
    private val receiverProvider: () -> Participant?,
    private val checkAndRequestPermission: (String) -> Boolean
) {
    fun startVideoCall(isVideo: Boolean) {
        val receiver = receiverProvider()
        val receiverId = receiver?._id
        val receiverName = receiver?.username
        val currentUserId = TokenManager.getUserId(activity)

        if (receiverId.isNullOrBlank() || currentUserId.isNullOrBlank()) {
            Toast.makeText(activity, R.string.missing_user_ids, Toast.LENGTH_SHORT).show()
            return
        }

        if (isVideo && !checkAndRequestPermission(Manifest.permission.CAMERA)) {
            Toast.makeText(activity, R.string.camera_permission_required, Toast.LENGTH_SHORT).show()
            return
        }

        if (!checkAndRequestPermission(Manifest.permission.RECORD_AUDIO)) {
            Toast.makeText(activity, R.string.microphone_permission_required, Toast.LENGTH_SHORT).show()
            return
        }

        val intent = Intent(activity, VideoCallActivity::class.java).apply {
            putExtra("CURRENT_USER_ID", currentUserId)
            putExtra("RECEIVER_ID", receiverId)
            putExtra("RECEIVER_NAME", receiverName)
            putExtra("IS_CALLER", true)
            putExtra("IS_VIDEO_CALL", isVideo)
        }

        Log.d(TAG, "Launching VideoCallActivity with CURRENT_USER_ID=$currentUserId, RECEIVER_ID=$receiverId")
        activity.startActivity(intent)
    }

    private companion object {
        const val TAG = "ChatCallController"
    }
}
