// In a new file, e.g., Participant.kt, or within ChatRoom.kt if you prefer (though separate is cleaner)
package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Participant(
    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String?, // Or String if always present

    @SerializedName("profileImage")
    val profileImage: String? // Or String if always present
)