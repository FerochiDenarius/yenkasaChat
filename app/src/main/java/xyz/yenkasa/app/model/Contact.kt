package xyz.yenkasa.app.model

data class Contact(
    val id: String,
    val _id: String? = null,
    val userId: String,
    val contactId: String? = null,
    val username: String,
    val location: String = "",
    val profileImage: String? = null,
    val profilePicture: String? = null,
    val verified: Boolean = false,
    val online: Boolean = false,
    val isOnline: Boolean = false,
    val lastSeen: String? = null,
    val lastInteraction: String? = null,
    val lastMessageTime: String? = null,
    val unreadCount: Int = 0,
    val roomId: String? = null
)
