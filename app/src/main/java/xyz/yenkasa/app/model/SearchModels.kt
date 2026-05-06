package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class SearchResponse(
    val success: Boolean = false,
    val query: String = "",
    val posts: List<Post> = emptyList(),
    val users: List<SearchUserResult> = emptyList(),
    val communities: List<Community> = emptyList()
)

data class SearchUserResult(
    @SerializedName("_id")
    val id: String,
    val username: String = "",
    val profileImage: String? = null,
    val verified: Boolean = false,
    val roleName: String? = null,
    val bio: String? = null,
    val rank: Int = 0,
    val followersCount: Int = 0,
    val followingCount: Int = 0
)
