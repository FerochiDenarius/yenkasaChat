package com.example.yenkasachat.network

import com.example.yenkasachat.model.RefreshTokenRequest
import com.example.yenkasachat.model.TokenResponse // Your existing response model
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface TokenRefreshApiService {
    // Replace "auth/token/refresh" with your ACTUAL server endpoint
    @POST("auth/token/refresh")
    suspend fun refreshAccessToken(
        @Body request: RefreshTokenRequest
    ): Response<TokenResponse> // Use your TokenResponse model here
}

