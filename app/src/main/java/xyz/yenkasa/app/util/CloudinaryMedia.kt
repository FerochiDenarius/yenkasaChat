package xyz.yenkasa.app.util

object CloudinaryMedia {
    private val cloudinaryDeliveryRegex =
        Regex("^https?://res\\.cloudinary\\.com/[^/]+/(image|video)/upload/", RegexOption.IGNORE_CASE)
    private val transformTokenRegex =
        Regex("(^|,)(a_|ar_|b_|bo_|c_|co_|d_|dpr_|e_|f_|fl_|g_|h_|l_|o_|q_|r_|so_|t_|u_|w_|x_|y_|z_)", RegexOption.IGNORE_CASE)

    const val WIDTH_AVATAR = 160
    const val WIDTH_THUMBNAIL = 300
    const val WIDTH_PREVIEW = 500
    const val WIDTH_FEED = 800
    const val WIDTH_FULL = 1200

    fun optimizedImageUrl(url: String?, width: Int = WIDTH_FEED): String? {
        if (url.isNullOrBlank()) return url
        val safeWidth = width.coerceIn(80, 1600)
        return injectTransformation(url, "image", listOf("f_auto", "q_auto", "w_$safeWidth", "c_limit"))
    }

    fun optimizedVideoUrl(url: String?): String? {
        if (url.isNullOrBlank()) return url
        return injectTransformation(url, "video", listOf("f_auto", "q_auto"))
    }

    fun videoPosterUrl(url: String?, width: Int = WIDTH_PREVIEW): String? {
        if (url.isNullOrBlank()) return null
        val safeWidth = width.coerceIn(80, 1600)
        return injectTransformation(url, "video", listOf("so_1", "f_jpg", "q_auto", "w_$safeWidth", "c_limit"))
    }

    fun optimizedForDisplay(url: String?, width: Int = WIDTH_FEED): String? {
        if (url.isNullOrBlank()) return url
        return when {
            url.contains("/image/upload/") -> optimizedImageUrl(url, width)
            url.contains("/video/upload/") -> optimizedVideoUrl(url)
            else -> url
        }
    }

    private fun injectTransformation(url: String, resourceType: String, desired: List<String>): String {
        if (!cloudinaryDeliveryRegex.containsMatchIn(url)) return url
        val marker = "/$resourceType/upload/"
        val markerIndex = url.indexOf(marker)
        if (markerIndex == -1) return url

        val prefixEnd = markerIndex + marker.length
        val prefix = url.substring(0, prefixEnd)
        val rest = url.substring(prefixEnd)
        val suffixIndex = rest.indexOfAny(charArrayOf('?', '#'))
        val path = if (suffixIndex == -1) rest else rest.substring(0, suffixIndex)
        val suffix = if (suffixIndex == -1) "" else rest.substring(suffixIndex)
        val segments = path.split("/")
        val first = segments.firstOrNull().orEmpty()

        if (first.isNotBlank() && transformTokenRegex.containsMatchIn(first) && !first.matches(Regex("^v\\d+$"))) {
            val merged = mergeTransformation(first, desired)
            return prefix + merged + "/" + segments.drop(1).joinToString("/") + suffix
        }

        return prefix + desired.joinToString(",") + "/" + path + suffix
    }

    private fun mergeTransformation(existing: String, desired: List<String>): String {
        val desiredPrefixes = desired.mapNotNull { it.substringBefore("_").takeIf(String::isNotBlank) }.toSet()
        val retained = existing
            .split(",")
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .filter { token -> token.substringBefore("_") !in desiredPrefixes }
        return (desired + retained).joinToString(",")
    }
}
