// In your model/UpdateProfileRequest.kt
package xyz.yenkasa.app.model

data class UpdateProfileRequest(
    val username: String? = null,
    val email: String? = null,
    val phoneNumber: String? = null,
    val location: String? = null,
    val gender: String? = null,
    val dateOfBirth: String? = null,
    val preferredLanguage: String? = null
)

data class UpdatePasswordRequest(
    val oldPassword: String,
    val newPassword: String
)
