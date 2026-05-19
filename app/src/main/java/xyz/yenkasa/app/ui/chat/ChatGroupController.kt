package xyz.yenkasa.app.ui.chat

import android.content.Intent
import android.util.Log
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.bumptech.glide.Glide
import de.hdodenhof.circleimageview.CircleImageView
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatRoom
import xyz.yenkasa.app.model.GroupResponse
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.GroupContactsSelectorActivity
import xyz.yenkasa.app.ui.GroupProfileActivity
import xyz.yenkasa.app.util.TokenManager

class ChatGroupController(
    private val activity: AppCompatActivity,
    private val isGroupChat: Boolean,
    private val roomIdProvider: () -> String?,
    private val initialGroupImageProvider: () -> String,
    private val initialGroupMemberCountProvider: () -> Int,
    private val receiverNameView: TextView,
    private val receiverImageView: CircleImageView,
    private val statusIndicatorView: ImageView,
    private val statusTextView: TextView,
    private val callButton: ImageView,
    private val videoCallButton: ImageView
) {
    private var currentGroupDetails: ChatRoom? = null
    private var released = false

    fun configureHeaderIfNeeded() {
        if (!isGroupChat) return
        callButton.visibility = View.GONE
        videoCallButton.visibility = View.GONE
        statusIndicatorView.visibility = View.GONE
        statusTextView.text = activity.getString(R.string.group_chat)
        refreshHeader()
    }

    fun refreshHeader() {
        if (!isGroupChat || released) return
        val groupId = roomIdProvider() ?: return
        ApiClient.apiService.getSingleGroup(groupId).enqueue(object : Callback<GroupResponse> {
            override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                if (released || !response.isSuccessful) return
                val group = response.body()?.group ?: return
                currentGroupDetails = group
                receiverNameView.text = group.groupName ?: receiverNameView.text
                statusTextView.text = if (group.memberCount > 0) {
                    activity.resources.getQuantityString(R.plurals.members_count, group.memberCount, group.memberCount)
                } else {
                    activity.getString(R.string.group_chat)
                }
                val imageUrl = group.groupImage.orEmpty()
                if (imageUrl.isNotBlank()) {
                    Glide.with(activity)
                        .load(imageUrl)
                        .placeholder(R.drawable.ic_default_profile)
                        .error(R.drawable.ic_default_profile)
                        .into(receiverImageView)
                }
            }

            override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                if (!released) {
                    Log.w(TAG, "Could not refresh group header: ${t.message}")
                }
            }
        })
    }

    fun openProfile() {
        val groupId = roomIdProvider()
        if (groupId.isNullOrBlank()) {
            Toast.makeText(activity, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }
        activity.startActivity(Intent(activity, GroupProfileActivity::class.java).apply {
            putExtra("groupId", groupId)
            putExtra("groupName", receiverNameView.text?.toString().orEmpty())
            putExtra("groupImage", initialGroupImageProvider())
            putExtra("groupMemberCount", initialGroupMemberCountProvider())
        })
    }

    fun openAddMembers() {
        val group = currentGroupDetails
        if (group == null) {
            Toast.makeText(activity, R.string.group_details_still_loading, Toast.LENGTH_SHORT).show()
            return
        }
        activity.startActivity(Intent(activity, GroupContactsSelectorActivity::class.java).apply {
            putExtra("mode", "addMembers")
            putExtra("groupId", group._id)
            putStringArrayListExtra(
                "existingMemberIds",
                ArrayList(group.participants.orEmpty().map { it._id })
            )
        })
    }

    fun confirmLeave() {
        val groupId = roomIdProvider()
        if (groupId.isNullOrBlank()) {
            Toast.makeText(activity, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(activity)
            .setTitle(R.string.leave_group_title)
            .setMessage(activity.getString(R.string.leave_group_message, activity.getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.leave) { _, _ ->
                ApiClient.apiService.leaveGroup(groupId).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (released) return
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(activity, response.body()?.message ?: activity.getString(R.string.could_not_leave_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(activity, R.string.you_left_group, Toast.LENGTH_SHORT).show()
                        activity.finish()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        if (!released) {
                            Toast.makeText(activity, activity.getString(R.string.could_not_leave_group_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                        }
                    }
                })
            }
            .show()
    }

    fun confirmDelete() {
        val groupId = roomIdProvider()
        if (groupId.isNullOrBlank()) {
            Toast.makeText(activity, R.string.group_details_unavailable, Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(activity)
            .setTitle(R.string.delete_group_title)
            .setMessage(activity.getString(R.string.delete_group_message, activity.getString(R.string.this_group)))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.delete) { _, _ ->
                ApiClient.apiService.deleteGroup(groupId).enqueue(object : Callback<GroupResponse> {
                    override fun onResponse(call: Call<GroupResponse>, response: Response<GroupResponse>) {
                        if (released) return
                        if (!response.isSuccessful || response.body()?.success == false) {
                            Toast.makeText(activity, response.body()?.message ?: activity.getString(R.string.could_not_delete_group), Toast.LENGTH_LONG).show()
                            return
                        }
                        Toast.makeText(activity, R.string.group_deleted, Toast.LENGTH_SHORT).show()
                        activity.finish()
                    }

                    override fun onFailure(call: Call<GroupResponse>, t: Throwable) {
                        if (!released) {
                            Toast.makeText(activity, activity.getString(R.string.could_not_delete_group_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                        }
                    }
                })
            }
            .show()
    }

    fun canManageCurrentGroup(): Boolean {
        val group = currentGroupDetails ?: return false
        val currentUserId = TokenManager.getUserId(activity).orEmpty()
        return currentUserId.isNotBlank() &&
            (group.groupCreatedBy == currentUserId || group.groupAdmins.contains(currentUserId))
    }

    fun release() {
        released = true
        currentGroupDetails = null
    }

    private companion object {
        const val TAG = "ChatGroupController"
    }
}
