package com.example.yenkasachat.network

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import java.net.URISyntaxException

object SocketManager {

    private var socket: Socket? = null
    private const val TAG = "SocketManager"

    // ✅ Use the same server base (no /api)
    private const val SOCKET_URL = "https://yenkasa-bldrv.ondigitalocean.app"

    fun connect(userId: String?) {
        if (userId.isNullOrEmpty()) {
            Log.w(TAG, "Cannot connect socket: userId is null or empty.")
            return
        }

        try {
            if (socket == null) {
                val opts = IO.Options().apply {
                    reconnection = true
                    reconnectionAttempts = 5
                    reconnectionDelay = 2000
                    forceNew = true
                }
                socket = IO.socket(SOCKET_URL, opts)
            }

            if (!(socket?.connected() ?: false)) {
                socket?.connect()
                socket?.on(Socket.EVENT_CONNECT) {
                    Log.i(TAG, "✅ Socket connected.")
                    emitUserConnected(userId)
                }
                socket?.on(Socket.EVENT_DISCONNECT) {
                    Log.w(TAG, "⚠️ Socket disconnected.")
                }
            }
        } catch (e: URISyntaxException) {
            Log.e(TAG, "Socket connection failed: ${e.message}", e)
        }
    }

    fun emitUserConnected(userId: String) {
        try {
            socket?.emit("userOnline", userId)
            Log.d(TAG, "Emitted userOnline for $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting userOnline", e)
        }
    }

    fun emitUserDisconnected(userId: String) {
        try {
            socket?.emit("userOffline", userId)
            Log.d(TAG, "Emitted userOffline for $userId")
        } catch (e: Exception) {
            Log.e(TAG, "Error emitting userOffline", e)
        }
    }

    fun disconnect() {
        try {
            if (socket != null && socket!!.connected()) {
                socket?.disconnect()
                Log.i(TAG, "Socket disconnected manually.")
            }
            socket = null
        } catch (e: Exception) {
            Log.e(TAG, "Error disconnecting socket", e)
        }
    }

    fun isConnected(): Boolean {
        return socket?.connected() ?: false
    }
}
