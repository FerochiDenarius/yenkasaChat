package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class PresenceResponse(
    @SerializedName("userId")
    val userId: String? = null,

    @SerializedName("_id")
    val id: String? = null,

    @SerializedName("username")
    val username: String? = null,

    @SerializedName("isOnline")
    val isOnline: Boolean = false,

    @SerializedName("online")
    val online: Boolean = false,

    @SerializedName("lastSeen")
    val lastSeen: String? = null,

    @SerializedName("statusText")
    val statusText: String? = null
) {
    val resolvedUserId: String?
        get() = userId ?: id

    val resolvedOnline: Boolean
        get() = isOnline || online
}
