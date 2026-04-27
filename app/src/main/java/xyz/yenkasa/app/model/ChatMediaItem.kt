package xyz.yenkasa.app.model

import java.io.Serializable

data class ChatMediaItem(
    val id: Long,
    val uriString: String,
    val mimeType: String,
    val displayName: String,
    val isVideo: Boolean,
    val durationMillis: Long = 0L,
    val selectionOrder: Int = 0,
    val isCameraShortcut: Boolean = false
) : Serializable
