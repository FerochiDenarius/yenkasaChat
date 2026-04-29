package xyz.yenkasa.app.model

data class ProfileResponse(
    val _id: String,
    val username: String,
    val email: String?,

    // FIXED: backend sends phoneNumber, not phone
    val phoneNumber: String?,

    val location: String?,
    val profileImage: String?,
    val verified: Boolean?,

    // ADD: backend sends these fields
    val gender: String? = null,
    val dateOfBirth: String? = null,

    // KEEP existing optional rich fields (backend may or may not send them)
    val followers: List<UserSummary> = emptyList(),
    val following: List<UserSummary> = emptyList(),
    val posts: List<Post> = emptyList(),
    val isFollowing: Boolean = false,
    val isBlocked: Boolean = false,

    val coinsBalance: Int? = null,
    val walletId: String? = null,
    val bio: String? = null,
    val website: String? = null,
    val externalLink: String? = null,
    val createdAt: String? = null,

    val community: CommunitySummary? = null,
    val followersCount: Int? = null,
    val followingCount: Int? = null
)


data class UserSummary(
    val _id: String,
    val username: String,
    val profileImage: String?
)

data class CommunitySummary(
    val _id: String,
    val name: String?
)


data class UploadPictureResponse(
    val success: Boolean,
    val imageUrl: String?
)

data class GenericSuccessResponse(
    val success: Boolean,
    val message: String? = null
)

data class UserProfileResponse(
    val success: Boolean,
    val user: User
)
