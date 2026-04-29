package xyz.yenkasa.app.model

data class UserPrivacyModel(
    val userId: String,
    val privacyLevel: String, // "everyone", "community_members", "requires_approval", "nobody"
    val blockedUsers: List<String>,
    val hiddenFromPostsUsers: List<String>,
    val hiddenFromCommunities: List<String>
)

data class SetPrivacyRequest(
    val privacyLevel: String
)

data class MessageRequest(
    val receiverId: String,
    val message: String?
)

data class ApiResponse(
    val success: Boolean,
    val message: String
)

data class PrivacyResponse(
    val privacyLevel: String,
    val blockedUsers: List<String>,
    val hiddenFromPostsUsers: List<String>,
    val hiddenFromCommunities: List<String>
)

