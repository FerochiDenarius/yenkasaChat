package com.example.yenkasachat.network

import android.util.Log
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object SocketManager {

    private const val SERVER_URL = "https://yenkasa-bldrv.ondigitalocean.app" // or your backend base URL

    private var mSocket: Socket? = null

    fun initSocket() {
        try {
            if (mSocket == null) {
                val opts = IO.Options()
                opts.reconnection = true
                opts.forceNew = true
                mSocket = IO.socket(SERVER_URL, opts)
            }
        } catch (e: Exception) {
            Log.e("SocketManager", "Socket initialization error: ${e.message}")
        }
    }

    fun getSocket(): Socket? {
        return mSocket
    }

    fun connect(userId: String) {
        try {
            initSocket()
            mSocket?.connect()
            Log.d("SocketManager", "🔌 Connecting socket for userId=$userId")

            mSocket?.on(Socket.EVENT_CONNECT) {
                Log.d("SocketManager", "✅ Socket connected!")
                val userData = JSONObject()
                userData.put("userId", userId)
                mSocket?.emit("userConnected", userData)
            }

            mSocket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("SocketManager", "❌ Socket disconnected")
                val userData = JSONObject()
                userData.put("userId", userId)
                mSocket?.emit("userDisconnected", userData)
            }

        } catch (e: Exception) {
            Log.e("SocketManager", "Error connecting socket: ${e.message}")
        }
    }

    fun disconnect(userId: String) {
        try {
            val userData = JSONObject()
            userData.put("userId", userId)
            mSocket?.emit("userDisconnected", userData)
            mSocket?.disconnect()
            Log.d("SocketManager", "🔴 Socket disconnected manually for $userId")
        } catch (e: Exception) {
            Log.e("SocketManager", "Error disconnecting socket: ${e.message}")
        }
    }
}
