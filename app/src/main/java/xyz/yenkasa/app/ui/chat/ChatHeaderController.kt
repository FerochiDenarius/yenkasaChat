package xyz.yenkasa.app.ui.chat

import android.content.Intent
import android.util.Log
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import de.hdodenhof.circleimageview.CircleImageView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.model.PresenceResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.UserProfileActivity

class ChatHeaderController(
    private val activity: AppCompatActivity,
    private val isGroupChatProvider: () -> Boolean,
    private val groupImageProvider: () -> String,
    private val groupMemberCountProvider: () -> Int,
    private val socketControllerProvider: () -> ChatSocketController?,
    private val receiverNameView: TextView,
    private val receiverImageView: CircleImageView,
    private val statusIndicatorView: ImageView,
    private val statusTextView: TextView
) {
    var receiverParticipant: Participant? = null
        private set

    fun handleReceiverParticipantDetails(participant: Participant) {
        receiverParticipant = participant
        socketControllerProvider()?.setReceiverParticipant(participant)
        updateReceiverHeader(participant)
        updateReceiverStatus(
            participant.resolvedOnline,
            activity.getString(if (participant.resolvedOnline) R.string.online else R.string.offline)
        )
        refreshReceiverPresence()
        socketControllerProvider()?.requestOnlineUsers()
    }

    fun updateReceiverStatus(isOnline: Boolean, statusText: String) {
        statusTextView.text = statusText
        statusIndicatorView.visibility = View.VISIBLE
        statusIndicatorView.setImageResource(
            if (isOnline) R.drawable.status_indicator_online else R.drawable.status_indicator_offline
        )
    }

    fun showDefaultHeader(defaultName: String?) {
        receiverNameView.text = defaultName ?: activity.getString(R.string.chat)
        val groupImage = groupImageProvider()
        if (isGroupChatProvider() && groupImage.isNotBlank()) {
            Glide.with(activity)
                .load(groupImage)
                .placeholder(R.drawable.ic_default_profile)
                .error(R.drawable.ic_default_profile)
                .into(receiverImageView)
        } else {
            receiverImageView.setImageResource(R.drawable.ic_default_profile)
        }

        val memberCount = groupMemberCountProvider()
        statusTextView.text = if (isGroupChatProvider()) {
            if (memberCount > 0) {
                activity.resources.getQuantityString(R.plurals.members_count, memberCount, memberCount)
            } else {
                activity.getString(R.string.group_chat)
            }
        } else {
            ""
        }
        statusIndicatorView.visibility = View.GONE
    }

    fun openReceiverProfile() {
        val receiverId = receiverParticipant?._id
        if (receiverId.isNullOrBlank()) {
            Toast.makeText(activity, R.string.user_profile_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        activity.startActivity(
            Intent(activity, UserProfileActivity::class.java).apply {
                putExtra("USER_ID", receiverId)
            }
        )
    }

    fun refreshReceiverPresence() {
        val receiverId = receiverParticipant?._id ?: return

        ApiClient.apiService.getUserPresence(receiverId)
            .enqueue(object : Callback<PresenceResponse> {
                override fun onResponse(
                    call: Call<PresenceResponse>,
                    response: Response<PresenceResponse>
                ) {
                    val presence = response.body()
                    if (!response.isSuccessful || presence == null) {
                        Log.w(TAG, "Presence refresh failed: ${response.code()}")
                        return
                    }

                    val isOnline = presence.resolvedOnline
                    activity.runOnUiThread {
                        updateReceiverStatus(
                            isOnline,
                            presence.statusText ?: activity.getString(if (isOnline) R.string.online else R.string.offline)
                        )
                    }
                }

                override fun onFailure(call: Call<PresenceResponse>, t: Throwable) {
                    Log.w(TAG, "Presence refresh error: ${t.message}")
                }
            })
    }

    private fun updateReceiverHeader(participant: Participant) {
        receiverNameView.text = participant.username
        Glide.with(activity)
            .load(participant.profileImage)
            .placeholder(R.drawable.ic_default_profile)
            .error(R.drawable.ic_default_profile)
            .into(receiverImageView)
    }

    private companion object {
        const val TAG = "ChatHeaderController"
    }
}
