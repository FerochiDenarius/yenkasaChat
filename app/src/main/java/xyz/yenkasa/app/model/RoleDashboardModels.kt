package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class RoleUsersResponse(
    val success: Boolean = false,
    val users: List<RoleUser> = emptyList(),
    val pagination: RolePagination? = null,
    val error: String? = null,
    val message: String? = null
)

data class RolePagination(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 0
)

data class RoleUser(
    val userId: String? = null,
    @SerializedName("_id") val id: String? = null,
    val username: String? = null,
    val email: String? = null,
    val profileImage: String? = null,
    val roleName: String? = null,
    val accessRole: String? = null,
    val staffRole: String? = null,
    val publicRoles: List<String> = emptyList(),
    val suspendedUntil: String? = null
) {
    fun resolvedId(): String = userId ?: id.orEmpty()
    fun displayRole(): String = staffRole ?: roleName ?: accessRole ?: "unverified"
    fun initials(): String {
        val name = username?.trim().orEmpty()
        if (name.isBlank()) return "YK"
        return name.split(Regex("\\s+|_|-"))
            .filter { it.isNotBlank() }
            .take(2)
            .joinToString("") { it.first().uppercaseChar().toString() }
            .ifBlank { name.take(2).uppercase() }
    }
}

data class GenerateRoleCodeRequest(
    val roleKey: String
)

data class GenerateRoleCodeResponse(
    val success: Boolean = false,
    val code: String? = null,
    val roleKey: String? = null,
    val roleLabel: String? = null,
    val roleCategory: String? = null,
    val expiresAt: String? = null,
    val expiresInDays: Int? = null,
    val error: String? = null,
    val message: String? = null
)

data class GeneratedRoleCodesResponse(
    val success: Boolean = false,
    val codes: List<GeneratedRoleCode> = emptyList(),
    val error: String? = null,
    val message: String? = null
)

data class GeneratedRoleCode(
    val code: String? = null,
    val roleKey: String? = null,
    val roleLabel: String? = null,
    val roleCategory: String? = null,
    val expiresAt: String? = null,
    val usedAt: String? = null
)

data class ActivateRoleCodeRequest(
    val code: String
)

data class ActivateRoleCodeResponse(
    val success: Boolean = false,
    val message: String? = null,
    val roleKey: String? = null,
    val roleLabel: String? = null,
    val user: User? = null,
    val error: String? = null
)

data class RoleActionRequest(
    val roleKey: String? = null,
    val role: String? = null,
    val days: Int? = null
)

data class RoleActionResponse(
    val success: Boolean = false,
    val message: String? = null,
    val user: RoleUser? = null,
    val suspendedUntil: String? = null,
    val error: String? = null
)
