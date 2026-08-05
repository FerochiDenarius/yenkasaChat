package xyz.yenkasa.app.model

data class MediaResponse(
    val success: Boolean = false,
    val media: MediaData
)

data class ChatMediaUploadResponse(
    val success: Boolean = false,
    val type: String? = null,
    val messageKey: String? = null,
    val url: String? = null,
    val publicId: String? = null,
    val originalName: String? = null,
    val mimeType: String? = null,
    val bytes: Long? = null
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
