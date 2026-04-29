package xyz.yenkasa.app.model

data class CreateCommunityResponse(
    val success: Boolean = false,
    val message: String? = null,
    val note: String? = null,
    val community: CreatedCommunityPayload? = null
)

data class CreatedCommunityPayload(
    val id: String = "",
    val name: String = "",
    val displayName: String = "",
    val country: String? = null,
    val isApproved: Boolean = false
)
