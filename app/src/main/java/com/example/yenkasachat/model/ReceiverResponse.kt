package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

/**
 * Represents the response from the server containing the receiver's details.
 */
data class ReceiverResponse(
    @SerializedName("receiver")
    val receiver: Participant?
)
