package xyz.yenkasa.app.model

data class MediaResponse(
    val success: Boolean = false,
    val media: MediaData
)

data class MediaData(
    val imageUrl: String? = null,
    val videoUrl: String? = null,
    val audioUrl: String? = null
)
