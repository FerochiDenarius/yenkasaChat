package xyz.yenkasa.app.network

import xyz.yenkasa.app.model.RefreshTokenRequest
import xyz.yenkasa.app.model.TokenResponse // Your existing response model
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

