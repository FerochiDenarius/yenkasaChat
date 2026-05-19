package xyz.yenkasa.app.ui.chat

import android.text.InputType
import android.view.WindowManager
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ApiResponse
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.MessageRequest
import xyz.yenkasa.app.model.Participant
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.ui.ChatActivityHelper

class ChatMessageActionController(
    private val activity: AppCompatActivity,
    private val senderIdProvider: () -> String,
    private val chatHelperProvider: () -> ChatActivityHelper,
    private val receiverProvider: () -> Participant?
) {
    fun requestDeleteConfirmation(messageToDelete: ChatMessage) {
        AlertDialog.Builder(activity)
            .setTitle(R.string.delete_message_title)
            .setMessage(activity.getString(R.string.delete_message_confirmation, messageToDelete.text ?: activity.getString(R.string.media_message)))
            .setPositiveButton(R.string.delete) { dialog, _ ->
                activity.lifecycleScope.launch {
                    chatHelperProvider().confirmDeleteMessageOnServer(messageToDelete)
                }
                dialog.dismiss()
            }
            .setNegativeButton(R.string.cancel) { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(true)
            .show()
    }

    fun requestEditMessage(messageToEdit: ChatMessage) {
        val senderId = senderIdProvider()
        if (messageToEdit.sender?._id != senderId && messageToEdit.senderId != senderId) {
            Toast.makeText(activity, R.string.edit_own_messages_only, Toast.LENGTH_SHORT).show()
            return
        }

        val currentText = messageToEdit.text.orEmpty()
        if (currentText.isBlank()) {
            Toast.makeText(activity, R.string.only_text_messages_can_be_edited, Toast.LENGTH_SHORT).show()
            return
        }

        val editText = EditText(activity).apply {
            setText(currentText)
            setSelection(text.length)
            minLines = 2
            maxLines = 5
            inputType = InputType.TYPE_CLASS_TEXT or
                    InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                    InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }

        val dialog = AlertDialog.Builder(activity)
            .setTitle(R.string.edit_message_title)
            .setView(editText)
            .setPositiveButton(R.string.save, null)
            .setNegativeButton(R.string.cancel, null)
            .create()

        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val nextText = editText.text.toString().trim()
                when {
                    nextText.isBlank() -> {
                        Toast.makeText(activity, R.string.message_cannot_be_empty, Toast.LENGTH_SHORT).show()
                    }
                    nextText == currentText -> dialog.dismiss()
                    else -> {
                        activity.lifecycleScope.launch {
                            chatHelperProvider().confirmEditMessageOnServer(messageToEdit, nextText)
                        }
                        dialog.dismiss()
                    }
                }
            }
        }

        dialog.show()
        editText.requestFocus()
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
    }

    fun sendMessageApprovalRequest(fallbackMessage: String) {
        val receiverId = receiverProvider()?._id
        if (receiverId.isNullOrBlank()) {
            Toast.makeText(activity, fallbackMessage, Toast.LENGTH_LONG).show()
            return
        }

        ApiClient.apiService.sendMessageRequest(MessageRequest(receiverId, null))
            .enqueue(object : Callback<ApiResponse> {
                override fun onResponse(call: Call<ApiResponse>, response: Response<ApiResponse>) {
                    if (response.isSuccessful) {
                        Toast.makeText(
                            activity,
                            R.string.message_request_sent_after_approval,
                            Toast.LENGTH_LONG
                        ).show()
                    } else {
                        Toast.makeText(activity, ChatErrorParser.parse(response), Toast.LENGTH_LONG).show()
                    }
                }

                override fun onFailure(call: Call<ApiResponse>, t: Throwable) {
                    Toast.makeText(
                        activity,
                        activity.getString(R.string.message_request_send_failed, t.message.orEmpty()),
                        Toast.LENGTH_LONG
                    ).show()
                }
            })
    }
}
