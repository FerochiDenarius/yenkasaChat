package xyz.yenkasa.app.ui.chat

import android.view.View
import android.widget.PopupMenu
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R

class ChatOptionsController(
    private val activity: AppCompatActivity,
    private val isGroupChatProvider: () -> Boolean,
    private val canManageGroup: () -> Boolean,
    private val openBackgroundPicker: () -> Unit,
    private val openProfile: () -> Unit,
    private val openAddMembers: () -> Unit,
    private val confirmLeaveGroup: () -> Unit,
    private val confirmDeleteGroup: () -> Unit
) {
    fun show(anchorView: View) {
        val popup = PopupMenu(activity, anchorView)
        popup.menu.add(0, MENU_CHANGE_BACKGROUND, 0, activity.getString(R.string.change_chat_background))
        popup.menu.add(
            0,
            MENU_VIEW_CONTACT,
            1,
            activity.getString(if (isGroupChatProvider()) R.string.view_group_profile else R.string.view_contact)
        )
        if (isGroupChatProvider()) {
            if (canManageGroup()) {
                popup.menu.add(0, MENU_ADD_GROUP_MEMBERS, 2, activity.getString(R.string.add_members))
                popup.menu.add(0, MENU_DELETE_GROUP, 3, activity.getString(R.string.delete_group))
            }
            popup.menu.add(0, MENU_LEAVE_GROUP, 4, activity.getString(R.string.leave_group))
        }
        popup.menu.add(0, MENU_MUTE_NOTIFICATIONS, 5, activity.getString(R.string.mute_notifications))
        popup.menu.add(0, MENU_CLEAR_CHAT, 6, activity.getString(R.string.clear_chat))

        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                MENU_CHANGE_BACKGROUND -> {
                    openBackgroundPicker()
                    true
                }
                MENU_VIEW_CONTACT -> {
                    openProfile()
                    true
                }
                MENU_ADD_GROUP_MEMBERS -> {
                    openAddMembers()
                    true
                }
                MENU_LEAVE_GROUP -> {
                    confirmLeaveGroup()
                    true
                }
                MENU_DELETE_GROUP -> {
                    confirmDeleteGroup()
                    true
                }
                MENU_MUTE_NOTIFICATIONS -> {
                    Toast.makeText(activity, R.string.mute_notifications_coming, Toast.LENGTH_SHORT).show()
                    true
                }
                MENU_CLEAR_CHAT -> {
                    Toast.makeText(activity, R.string.clear_chat_coming, Toast.LENGTH_SHORT).show()
                    true
                }
                else -> false
            }
        }
        popup.show()
    }

    private companion object {
        const val MENU_CHANGE_BACKGROUND = 1
        const val MENU_VIEW_CONTACT = 2
        const val MENU_MUTE_NOTIFICATIONS = 3
        const val MENU_CLEAR_CHAT = 4
        const val MENU_ADD_GROUP_MEMBERS = 5
        const val MENU_LEAVE_GROUP = 6
        const val MENU_DELETE_GROUP = 7
    }
}
