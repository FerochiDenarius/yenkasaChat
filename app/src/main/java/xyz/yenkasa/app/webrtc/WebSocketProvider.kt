package xyz.yenkasa.app.webrtc

/**
 * WebSocketProvider
 *
 * This ensures that your entire app uses ONE shared WebSocketManager instance.
 * Prevents duplicate connections (Code 1006 disconnects) and keeps signaling stable.
 */
object WebSocketProvider {

    // Lazy means it’s only created once, the first time it’s used
    val instance: WebSocketManager by lazy {
        WebSocketManager()
    }
}
