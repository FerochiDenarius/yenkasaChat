package xyz.yenkasa.app.model

data class MediaResponse(
    val success: Boolean = false,
    val media: MediaData
)

data class MediaData(
    val imageUrl: String? = null,
    val imageUrls: List<String>? = emptyList(),
    val videoUrl: String? = null,
    val audioUrl: String? = null
) {
    fun firstImageUrl(): String? {
        return imageUrls.orEmpty().firstOrNull { it.isNotBlank() }
            ?: imageUrl?.takeIf { it.isNotBlank() }
    }
}
