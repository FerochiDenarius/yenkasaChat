package xyz.yenkasa.app.model

data class CreateYenkasaUpdateRequest(
    val title: String,
    val body: String,
    val category: String = "announcement",
    val targetType: String = "system",
    val targetUrl: String? = null,
    val deepLinkUrl: String? = null,
    val pinned: Boolean = false
)

data class CreateYenkasaUpdateResponse(
    val success: Boolean,
    val message: String? = null,
    val update: NotificationModel? = null
)
