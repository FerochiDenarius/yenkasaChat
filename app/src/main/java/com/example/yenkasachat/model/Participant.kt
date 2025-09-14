// In model/Participant.kt (or model/ParticipantUI.kt)
package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Participant(
    @SerializedName("_id")
    val _id: String,
    @SerializedName("username")
    val username: String?,
    @SerializedName("profileImage")
    val profileImage: String?,
    @SerializedName("isOnline")
    val isOnline: Boolean? = false, // Default to false
    @SerializedName("lastSeen")
    val lastSeen: String? // Raw ISO8601 date string, format in UI if needed
    // You can add a formatted getter for lastSeen here if desired, similar to ChatRoom
)