package xyz.yenkasa.app.repository

import xyz.yenkasa.app.model.UnreadCountRequest
import xyz.yenkasa.app.model.UnreadCountResponse
import xyz.yenkasa.app.model.RoomUnreadCountResponse
import xyz.yenkasa.app.model.AllUnreadCountsResponse
import xyz.yenkasa.app.network.ApiService
import retrofit2.Response

class UnreadCountRepository(private val apiService: ApiService) {

    suspend fun incrementUnreadCount(request: UnreadCountRequest): Response<UnreadCountResponse> {
        return apiService.incrementUnreadCount(request)
    }

    suspend fun resetUnreadCount(request: UnreadCountRequest): Response<UnreadCountResponse> {
        return apiService.resetUnreadCount(request)
    }

    suspend fun getUnreadCountForRoom(userId: String, roomId: String): Response<RoomUnreadCountResponse> {
        return apiService.getUnreadCountForRoom(userId, roomId)
    }

    suspend fun getAllUnreadCountsForUser(userId: String): Response<AllUnreadCountsResponse> {
        return apiService.getAllUnreadCountsForUser(userId)
    }
}