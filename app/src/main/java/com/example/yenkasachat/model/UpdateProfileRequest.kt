// In your model/UpdateProfileRequest.kt
package com.example.yenkasachat.model

data class UpdateProfileRequest(
    val username: String? = null,
    val email: String? = null, // Ensure this line is present
    val phone: String? = null,
    val location: String? = null
)