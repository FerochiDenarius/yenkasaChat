package xyz.yenkasa.app.ui.chat

import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.ChatMessage
import xyz.yenkasa.app.model.Contact
import xyz.yenkasa.app.model.CreateChatRoomRequest
import xyz.yenkasa.app.model.CreateChatRoomResponse
import xyz.yenkasa.app.network.ApiClient

class ChatForwardController(
    private val activity: AppCompatActivity,
    private val senderIdProvider: () -> String,
    private val parseError: (Response<*>) -> String
) {
    fun requestForwardMessage(message: ChatMessage) {
        if (!hasForwardableContent(message)) {
            Toast.makeText(activity, R.string.message_cannot_be_forwarded, Toast.LENGTH_SHORT).show()
            return
        }

        Toast.makeText(activity, R.string.loading_contacts, Toast.LENGTH_SHORT).show()
        ApiClient.apiService.getContacts().enqueue(object : Callback<List<Contact>> {
            override fun onResponse(call: Call<List<Contact>>, response: Response<List<Contact>>) {
                if (!response.isSuccessful) {
                    Toast.makeText(
                        activity,
                        activity.getString(R.string.could_not_load_contacts_with_error, parseError(response)),
                        Toast.LENGTH_LONG
                    ).show()
                    return
                }

                val contacts = response.body().orEmpty()
                if (contacts.isEmpty()) {
                    Toast.makeText(activity, R.string.no_contacts_to_forward_to, Toast.LENGTH_SHORT).show()
                    return
                }

                showForwardContactPicker(message, contacts)
            }

            override fun onFailure(call: Call<List<Contact>>, t: Throwable) {
                Toast.makeText(activity, activity.getString(R.string.could_not_load_contacts_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun showForwardContactPicker(message: ChatMessage, contacts: List<Contact>) {
        val labels = contacts.map { contact ->
            if (contact.location.isBlank()) contact.username else "${contact.username} - ${contact.location}"
        }.toTypedArray()

        AlertDialog.Builder(activity)
            .setTitle(R.string.forward_to)
            .setItems(labels) { dialog, which ->
                dialog.dismiss()
                forwardMessageToContact(message, contacts[which])
            }
            .setNegativeButton(R.string.cancel, null)
            .show()
    }

    private fun forwardMessageToContact(message: ChatMessage, contact: Contact) {
        Toast.makeText(activity, activity.getString(R.string.forwarding_to, contact.username), Toast.LENGTH_SHORT).show()
        ApiClient.apiService.createChatRoom(CreateChatRoomRequest(username = contact.username))
            .enqueue(object : Callback<CreateChatRoomResponse> {
                override fun onResponse(
                    call: Call<CreateChatRoomResponse>,
                    response: Response<CreateChatRoomResponse>
                ) {
                    val targetRoomId = response.body()?.roomId
                    if (!response.isSuccessful || targetRoomId.isNullOrBlank()) {
                        Toast.makeText(
                            activity,
                            activity.getString(R.string.could_not_open_chat_with_error, response.body()?.message ?: parseError(response)),
                            Toast.LENGTH_LONG
                        ).show()
                        return
                    }

                    sendForwardedMessage(message, targetRoomId, contact.username)
                }

                override fun onFailure(call: Call<CreateChatRoomResponse>, t: Throwable) {
                    Toast.makeText(activity, activity.getString(R.string.could_not_open_chat_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
                }
            })
    }

    private fun sendForwardedMessage(message: ChatMessage, targetRoomId: String, targetName: String) {
        val payload = buildForwardPayload(message, targetRoomId).toMutableMap()
        if (payload.isEmpty()) {
            Toast.makeText(activity, R.string.message_cannot_be_forwarded, Toast.LENGTH_SHORT).show()
            return
        }

        ApiClient.apiService.sendMessage(payload).enqueue(object : Callback<ChatMessage> {
            override fun onResponse(call: Call<ChatMessage>, response: Response<ChatMessage>) {
                if (response.isSuccessful) {
                    Toast.makeText(activity, activity.getString(R.string.forwarded_to, targetName), Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(
                        activity,
                        activity.getString(R.string.forward_failed_with_error, parseError(response)),
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onFailure(call: Call<ChatMessage>, t: Throwable) {
                Toast.makeText(activity, activity.getString(R.string.forward_failed_with_error, t.message.orEmpty()), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun buildForwardPayload(message: ChatMessage, targetRoomId: String?): Map<String, Any?> {
        val payload = mutableMapOf<String, Any?>()
        targetRoomId?.let { payload["roomId"] = it }
        payload["senderId"] = senderIdProvider()
        com.onesignal.OneSignal.getDeviceState()?.userId?.let { playerId ->
            if (playerId.isNotBlank()) payload["playerId"] = playerId
        }

        message.text?.takeIf { it.isNotBlank() }?.let { payload["text"] = it }
        message.imageUrl?.takeIf { it.isNotBlank() }?.let { payload["imageUrl"] = it }
        message.audioUrl?.takeIf { it.isNotBlank() }?.let { payload["audioUrl"] = it }
        message.videoUrl?.takeIf { it.isNotBlank() }?.let { payload["videoUrl"] = it }
        message.fileUrl?.takeIf { it.isNotBlank() }?.let { payload["fileUrl"] = it }
        message.contactInfo?.takeIf { it.isNotBlank() }?.let { payload["contactInfo"] = it }
        message.location?.let {
            payload["location"] = mapOf("latitude" to it.latitude, "longitude" to it.longitude)
        }

        return payload.filterKeys { key ->
            key == "roomId" ||
                key == "senderId" ||
                key == "playerId" ||
                key == "text" ||
                key == "imageUrl" ||
                key == "audioUrl" ||
                key == "videoUrl" ||
                key == "fileUrl" ||
                key == "contactInfo" ||
                key == "location"
        }.filterValues { value -> value != null }
    }

    private fun hasForwardableContent(message: ChatMessage): Boolean {
        return !message.text.isNullOrBlank() ||
            !message.imageUrl.isNullOrBlank() ||
            !message.audioUrl.isNullOrBlank() ||
            !message.videoUrl.isNullOrBlank() ||
            !message.fileUrl.isNullOrBlank() ||
            !message.contactInfo.isNullOrBlank() ||
            message.location != null
    }
}
