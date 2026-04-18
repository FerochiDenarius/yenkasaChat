package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class Community(
    @SerializedName("_id")
    val id: String? = null,   // Prevents null crash in sets/maps

    val name: String? = null,
    val displayName: String? = null,
    val description: String? = null,
    val location: String? = null,
    val country: String? = null,
    val state: String? = null,
    val city: String? = null,
    val town: String? = null,
    val communityLevel: String? = null,
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

    // Membership status fields
    @SerializedName("isJoined")
    val isJoined: Boolean = false,

    @SerializedName("isMember")
    val isMember: Boolean = false,

    @SerializedName("joinedAt")
    val joinedAt: String? = null,

    @SerializedName("membershipStatus")
    val membershipStatus: String? = null,

    // Classification
    @SerializedName("communityType")
    val communityType: String? = null,

    @SerializedName("distance")
    val distance: Double? = null,

    // User-specific permissions
    @SerializedName("canPost")
    val canPost: Boolean = false,

    @SerializedName("canModerate")
    val canModerate: Boolean = false,

    // 🆕 ADD THIS ↓↓↓
    @SerializedName("isRegistration")
    val isRegistration: Boolean = false
) {

    override fun hashCode(): Int = id?.hashCode() ?: 0

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is Community) return false
        return this.id == other.id
    }

    fun isUserMember(): Boolean {
        return isJoined || isMember || membershipStatus in listOf("member", "moderator", "admin")
    }

    fun isLocalCommunity(): Boolean {
        return communityType == "local" ||
                (location != null && distance != null && distance < 50.0)
    }
}
data class UserPrimaryCommunityResponse(
    val success: Boolean,
    val community: Community? // reuse your existing Community model
)
