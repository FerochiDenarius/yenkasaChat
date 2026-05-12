package xyz.yenkasa.app.model

data class Contact(
    val id: String,
    val userId: String,
    val contactId: String? = null,
    val username: String,
    val location: String = "",
    val profileImage: String? = null,
    val online: Boolean = false,
    val isOnline: Boolean = false,
    val lastSeen: String? = null,
    val lastMessageTime: String? = null,
    val roomId: String? = null
)
