package xyz.yenkasa.app.model

data class CreateCommunityRequest(
    val name: String,                  // required, maybe slug or same as displayName
    val displayName: String,
    val description: String? = null,
    val location: String? = null,
    val country: String? = null,
    val state: String? = null,
    val city: String? = null,
    val town: String? = null,
    val communityLevel: String? = null,
    val categories: List<String>? = emptyList(),
    val isPrivate: Boolean = false,
    val isActive: Boolean = true,
    val isApproved: Boolean = false
)
