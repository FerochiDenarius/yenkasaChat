package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName // <--- IMPORT THIS

data class CreateChatRoomResponse(
    @SerializedName("success") // Good practice to annotate all fields from JSON
    val success: Boolean = false,

    @SerializedName("_id")     // <--- THE FIX: Map JSON "_id" to this field
    val roomId: String?,       // Changed to String? to initially match your definition
    // Consider changing to String if never null on success

    @SerializedName("message") // Good practice
    val message: String? = null,

    // IMPORTANT: Your backend POST /api/chatrooms route also returns 'name', 'participants',
    // 'isGroupChat', 'createdAt', 'updatedAt'.
    // If you need these in MainActivity after creating/getting a room, add them here
    // with their respective @SerializedName annotations.
    // Example:
    // @SerializedName("name")
    // val name: String?,
    //
    // @SerializedName("participants")
    // val participants: List<Participant>?, // You'll need a Participant data class
    //
    // @SerializedName("isGroupChat")
    // val isGroupChat: Boolean?,
    //
    // @SerializedName("createdAt")
    // val createdAt: String?,
    //
    // @SerializedName("updatedAt")
    // val updatedAt: String?
)

