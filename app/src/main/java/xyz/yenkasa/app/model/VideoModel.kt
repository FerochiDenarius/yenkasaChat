package xyz.yenkasa.app.model

/**
 * Contains data models for the Daily.co video integration.
 */

// --- Daily.co API Models ---

data class CreateRoomRequest(
    val roomName: String
)

data class CreateRoomResponse(
    val roomName: String,
    val roomUrl: String
)

data class GenerateTokenRequest(
    val roomName: String,
    val _id: String // Assuming this is the user ID
)

data class GenerateTokenResponse(
    val token: String,
    val roomName: String
)
