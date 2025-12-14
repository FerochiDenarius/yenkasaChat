package xyz.yenkasa.app.model

data class PushNotificationRequest(
    val playerId: String,
    val title: String,
    val body: String
)
