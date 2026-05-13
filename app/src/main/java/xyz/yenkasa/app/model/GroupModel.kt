package xyz.yenkasa.app.model

data class GroupCreateRequest(
    val groupName: String,
    val groupBio: String = "",
    val groupImage: String = "",
    val memberIds: List<String>
)

data class GroupMembersRequest(
    val memberIds: List<String>
)

data class GroupMemberRequest(
    val memberId: String
)

data class GroupProfileUpdateRequest(
    val groupName: String? = null,
    val groupBio: String? = null,
    val groupImage: String? = null
)

data class GroupResponse(
    val success: Boolean,
    val group: ChatRoom? = null,
    val message: String? = null
)

data class GroupsListResponse(
    val success: Boolean,
    val groups: List<ChatRoom> = emptyList(),
    val page: Int = 1,
    val hasMore: Boolean = false,
    val message: String? = null
)

data class GroupImageUploadResponse(
    val success: Boolean,
    val imageUrl: String? = null,
    val url: String? = null,
    val publicId: String? = null,
    val message: String? = null
)
