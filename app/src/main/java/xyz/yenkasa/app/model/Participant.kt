package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class Participant(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String? = null,

    // Backend may send either avatar or profileImage
    @SerializedName("avatar")
    val avatar: String? = null,

    @SerializedName("profileImage")
    val profileImage: String? = null,

    // Prepare for online status
    @SerializedName("isOnline")
    val isOnline: Boolean = false,

    @SerializedName("online")
    val online: Boolean = false,

    @SerializedName("lastSeen")
    val lastSeen: String? = null
) {
    // Always prefer profileImage if available, else fallback to avatar
    val displayImage: String?
        get() = profileImage ?: avatar

    val resolvedOnline: Boolean
        get() = isOnline || online
}
