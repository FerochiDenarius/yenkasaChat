package com.example.yenkasachat.repository

import com.example.yenkasachat.model.*
import com.example.yenkasachat.model.UnreadCountRequest
import com.example.yenkasachat.model.UnreadCountResponse
import com.example.yenkasachat.model.RoomUnreadCountResponse
import com.example.yenkasachat.model.AllUnreadCountsResponse
import com.example.yenkasachat.network.ApiService
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