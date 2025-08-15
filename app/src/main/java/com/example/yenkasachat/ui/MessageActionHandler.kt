// File: app/src/main/java/com/example/yenkasachat/ui/MessageActionHandler.kt
package com.example.yenkasachat.ui // Should match your package structure

import android.content.Context
import android.util.Log
import android.view.View
import android.widget.PopupMenu
import android.widget.Toast
import com.example.yenkasachat.R // Ensure this import is correct for your project
import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.ui.MessageActionHandler
import com.example.yenkasachat.ui.OnMessageActionListener

// 1. Interface defining the callbacks


// 2. The class responsible for the PopupMenu
class MessageActionHandler(
    private val context: Context,
    private val currentUserId: String,
    private val listener: OnMessageActionListener // Instance of the interface above
) {

    fun showPopupMenu(message: ChatMessage, anchorView: View, positionInAdapter: Int) {
        val popup = PopupMenu(context, anchorView)
        try {
            popup.menuInflater.inflate(R.menu.message_context_menu, popup.menu)
        } catch (e: Exception) {
            Log.e("MessageActionHandler", "Error inflating menu: R.menu.message_context_menu. Check if menu resource exists.", e)
            Toast.makeText(context, "Error showing menu options.", Toast.LENGTH_SHORT).show()
            return
        }

        // --- Dynamically show/hide menu items ---
        val copyItem = popup.menu.findItem(R.id.action_copy_text)
        val deleteItem = popup.menu.findItem(R.id.action_delete_message)
        val editItem = popup.menu.findItem(R.id.action_edit_message)
        val replyItem = popup.menu.findItem(R.id.action_reply_message)
        val forwardItem = popup.menu.findItem(R.id.action_forward_message)
        val infoItem = popup.menu.findItem(R.id.action_message_info)
        val pinItem = popup.menu.findItem(R.id.action_pin_message)
        val reactTickItem = popup.menu.findItem(R.id.action_react_tick)
        val reactCrossItem = popup.menu.findItem(R.id.action_react_cross)
        val reactWithImageItem = popup.menu.findItem(R.id.action_react_with_image)
        val markItem = popup.menu.findItem(R.id.action_mark_message)

        copyItem?.isVisible = !message.text.isNullOrBlank()
        deleteItem?.isVisible = message.senderId == currentUserId
        editItem?.isVisible = message.senderId == currentUserId && !message.text.isNullOrBlank()

        // Placeholder for other visibility logic
        // e.g., pinItem?.title = if (message.isPinned) "Unpin" else "Pin"
        // replyItem?.isVisible = true // etc.

        popup.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_copy_text -> listener.onCopyText(message)
                R.id.action_delete_message -> listener.onDeleteMessage(message, positionInAdapter)
                R.id.action_reply_message -> listener.onReplyToMessage(message)
                R.id.action_forward_message -> listener.onForwardMessage(message)
                R.id.action_edit_message -> listener.onEditMessage(message, positionInAdapter)
                R.id.action_pin_message -> listener.onPinMessage(message, positionInAdapter)
                R.id.action_react_tick -> listener.onReact(message, "✅", positionInAdapter)
                R.id.action_react_cross -> listener.onReact(message, "❌", positionInAdapter)
                R.id.action_react_with_image -> listener.onReactWithImage(message, positionInAdapter)
                R.id.action_mark_message -> listener.onMarkMessage(message, positionInAdapter)
                R.id.action_message_info -> listener.onShowMessageInfo(message)
                else -> return@setOnMenuItemClickListener false
            }
            true
        }
        popup.show()
    }
}
