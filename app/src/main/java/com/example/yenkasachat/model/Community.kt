package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Community(

    @SerializedName("_id")
    val id: String? = null,   // ✅ Prevents null crash in sets/maps

    val name: String? = null,
    val displayName: String? = null,
    val description: String? = null,
    val location: String? = null,
    val categories: List<String> = emptyList(),

    val coverImage: String? = null,
    val icon: String? = null,

    val memberCount: Int = 0,
    val postCount: Int = 0,

    val isActive: Boolean = true,
    val isPrivate: Boolean = false,
    val isApproved: Boolean = true,

    @SerializedName("createdBy")
    val createdById: String? = null,

    val moderators: List<String> = emptyList(),
    val pinnedPosts: List<String> = emptyList(),

    val createdAt: String? = null,
    val updatedAt: String? = null,

    // 🆕 Added field — helps split "Joined Communities" vs "Other Communities"
    @SerializedName("isJoined")
    val isJoined: Boolean = false
) {
    override fun hashCode(): Int = id?.hashCode() ?: 0

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Community) return false
        return this.id == other.id
    }
}
