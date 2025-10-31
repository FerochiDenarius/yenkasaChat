package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

/**
 * This data class represents the expected JSON response from the server
 * AFTER a community has been successfully created.
 *
 * All properties have default values to prevent crashes if the server
 * response is missing a field.
 */
data class CreateCommunityResponse(
    @SerializedName("_id")
    val id: String = "", // Default to an empty string

    @SerializedName("name")
    val name: String = "", // ✅ FIX: Added default value

    @SerializedName("displayName")
    val displayName: String = "", // ✅ FIX: Added default value

    @SerializedName("description")
    val description: String? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("categories")
    val categories: List<String> = emptyList(), // Use a non-nullable list with a default empty list

    @SerializedName("isPrivate")
    val isPrivate: Boolean = false,

    @SerializedName("isActive")
    val isActive: Boolean = false, // Default to false, server will confirm true status

    @SerializedName("isApproved")
    val isApproved: Boolean = false, // Default to false

    @SerializedName("members")
    val members: List<String> = emptyList(),

    @SerializedName("createdBy")
    val createdBy: String = ""
)
