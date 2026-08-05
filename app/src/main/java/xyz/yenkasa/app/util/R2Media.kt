package xyz.yenkasa.app.util

@Suppress("UNUSED_PARAMETER")
object R2Media {
    const val WIDTH_AVATAR = 160
    const val WIDTH_THUMBNAIL = 300
    const val WIDTH_PREVIEW = 500
    const val WIDTH_FEED = 800
    const val WIDTH_FULL = 1200

    fun optimizedImageUrl(url: String?, width: Int = WIDTH_FEED): String? = clean(url)

    fun optimizedVideoUrl(url: String?): String? = clean(url)

    fun optimizedForDisplay(url: String?, width: Int = WIDTH_FEED): String? = clean(url)

    private fun clean(url: String?): String? = url?.trim()?.takeIf { it.isNotBlank() }
}
