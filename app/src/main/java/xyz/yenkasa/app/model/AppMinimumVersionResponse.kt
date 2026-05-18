package xyz.yenkasa.app.model

data class AppMinimumVersionResponse(
    val minimumVersionCode: Long = 0,
    val latestVersionCode: Long = 0,
    val forceUpdate: Boolean = false,
    val updateMessage: String? = null
)
