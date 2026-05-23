package xyz.yenkasa.app.model

data class SharePostResponse(
    val success: Boolean = false,
    val message: String = "",
    val shareCount: Int = 0,
    val duplicate: Boolean = false
)
