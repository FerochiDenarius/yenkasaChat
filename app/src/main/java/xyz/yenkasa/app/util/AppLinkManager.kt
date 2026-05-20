package xyz.yenkasa.app.util

import android.content.Context
import android.content.Intent
import android.net.Uri
import java.util.Locale
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.ui.MainActivity

object AppLinkManager {
    const val WEB_SCHEME = "https"
    const val WEB_HOST = "www.yenkasa.xyz"
    private const val ALT_WEB_HOST = "yenkasa.xyz"
    private const val WEB_BASE = "https://www.yenkasa.xyz"

    const val EXTRA_PENDING_DEEP_LINK = "pending_deep_link"
    const val EXTRA_COMMUNITY_IDENTIFIER = "deep_link_community_identifier"
    const val EXTRA_OPEN_MEDIA_FROM_DEEP_LINK = "open_media_from_deep_link"
    const val EXTRA_START_AT_SECONDS = "start_at_seconds"

    sealed interface Route {
        data class Post(val postId: String, val startAtSeconds: Int?) : Route
        data class User(val identifier: String) : Route
        data class CommunityRoute(val identifier: String) : Route
        data class Live(val streamId: String) : Route
    }

    fun canonicalizeUri(raw: String?): Uri? {
        val trimmed = raw?.trim()?.takeIf { it.isNotBlank() } ?: return null
        return when {
            trimmed.startsWith("/") -> Uri.parse("$WEB_BASE$trimmed")
            trimmed.startsWith("http://") || trimmed.startsWith("https://") -> Uri.parse(trimmed)
            trimmed.startsWith(WEB_HOST) || trimmed.startsWith(ALT_WEB_HOST) -> Uri.parse("$WEB_SCHEME://$trimmed")
            else -> null
        }
    }

    fun isSupportedAppLink(uri: Uri?): Boolean {
        if (uri == null) return false
        if (!uri.scheme.equals(WEB_SCHEME, ignoreCase = true)) return false
        val host = uri.host?.lowercase(Locale.US).orEmpty()
        return host == WEB_HOST || host == ALT_WEB_HOST
    }

    fun parseRoute(rawUrl: String?): Route? = parseRoute(canonicalizeUri(rawUrl))

    fun parseRoute(uri: Uri?): Route? {
        val safeUri = uri ?: return null
        if (!isSupportedAppLink(safeUri)) return null
        val segments = safeUri.pathSegments.filter { it.isNotBlank() }
        if (segments.isEmpty()) return null

        val head = segments.first().lowercase(Locale.US)
        return when {
            head == "post" -> buildPostRoute(safeUri, segments.getOrNull(1))
            head == "user" || head == "profile" -> buildUserRoute(segments.getOrNull(1))
            head == "community" -> buildCommunityRoute(segments.getOrNull(1))
            head == "live" -> buildLiveRoute(segments.getOrNull(1))
            head == "web" && segments.getOrNull(1)?.equals("post", ignoreCase = true) == true ->
                buildPostRoute(safeUri, segments.getOrNull(2))
            else -> null
        }
    }

    fun buildMainActivityIntent(context: Context, uri: Uri): Intent {
        return Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri
        }
    }

    fun copyPendingDeepLink(source: Intent?, target: Intent): Intent {
        val rawLink = source?.getStringExtra(EXTRA_PENDING_DEEP_LINK)
            ?.trim()
            ?.takeIf { it.isNotBlank() }
            ?: source?.dataString
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?.takeIf { isSupportedAppLink(canonicalizeUri(it)) }

        if (!rawLink.isNullOrBlank()) {
            val uri = canonicalizeUri(rawLink) ?: Uri.parse(rawLink)
            target.putExtra(EXTRA_PENDING_DEEP_LINK, uri.toString())
            target.action = Intent.ACTION_VIEW
            target.data = uri
        }
        return target
    }

    fun buildPostUrl(postId: String, startAtSeconds: Int? = null): String {
        val builder = baseUriBuilder().appendPath("post").appendPath(postId)
        if (startAtSeconds != null && startAtSeconds > 0) {
            builder.appendQueryParameter("t", startAtSeconds.toString())
        }
        return builder.build().toString()
    }

    fun buildProfileUrl(identifier: String): String {
        return baseUriBuilder().appendPath("user").appendPath(identifier).build().toString()
    }

    fun buildCommunityUrl(identifier: String): String {
        return baseUriBuilder().appendPath("community").appendPath(identifier).build().toString()
    }

    fun buildLiveUrl(streamId: String): String {
        return baseUriBuilder().appendPath("live").appendPath(streamId).build().toString()
    }

    fun buildShareText(primaryText: String?, url: String): String {
        return listOfNotNull(primaryText?.trim()?.takeIf { it.isNotBlank() }, url)
            .joinToString("\n\n")
            .ifBlank { url }
    }

    fun communityShareIdentifier(community: Community): String {
        return community.id?.trim().orEmpty().ifBlank {
            slugify(community.displayName ?: community.name)
        }
    }

    fun matchesCommunityIdentifier(community: Community, identifier: String): Boolean {
        val trimmed = identifier.trim()
        if (trimmed.isBlank()) return false
        val normalized = normalizedIdentifier(trimmed)
        return listOf(community.id, community.name, community.displayName).any { candidate ->
            val value = candidate?.trim().orEmpty()
            value.equals(trimmed, ignoreCase = true) || normalizedIdentifier(value) == normalized
        }
    }

    fun slugify(value: String?): String {
        return value
            ?.trim()
            ?.lowercase(Locale.US)
            ?.replace("[^a-z0-9]+".toRegex(), "-")
            ?.trim('-')
            .orEmpty()
    }

    fun isLikelyObjectId(value: String): Boolean {
        return value.matches(Regex("^[A-Fa-f0-9]{24}$"))
    }

    private fun buildPostRoute(uri: Uri, postId: String?): Route? {
        val id = postId?.trim()?.takeIf { it.isNotBlank() } ?: return null
        val startAtSeconds = uri.getQueryParameter("t")?.toIntOrNull()?.takeIf { it >= 0 }
        return Route.Post(id, startAtSeconds)
    }

    private fun buildUserRoute(identifier: String?): Route? {
        val value = identifier?.trim()?.takeIf { it.isNotBlank() } ?: return null
        return Route.User(value)
    }

    private fun buildCommunityRoute(identifier: String?): Route? {
        val value = identifier?.trim()?.takeIf { it.isNotBlank() } ?: return null
        return Route.CommunityRoute(value)
    }

    private fun buildLiveRoute(streamId: String?): Route? {
        val value = streamId?.trim()?.takeIf { it.isNotBlank() } ?: return null
        return Route.Live(value)
    }

    private fun baseUriBuilder(): Uri.Builder {
        return Uri.Builder().scheme(WEB_SCHEME).authority(WEB_HOST)
    }

    private fun normalizedIdentifier(value: String?): String {
        val slug = slugify(value)
        return if (slug.isNotBlank()) slug else value?.trim()?.lowercase(Locale.US).orEmpty()
    }
}
