package xyz.yenkasa.app.model

data class FollowListResponse(
    val followers: List<User> = emptyList(),
    val following: List<User> = emptyList(),
    val pagination: FollowPagination? = null
)

data class FollowPagination(
    val currentPage: Int? = null,
    val totalPages: Int? = null,
    val totalFollowers: Int? = null,
    val totalFollowing: Int? = null,
    val hasMore: Boolean? = null
)
