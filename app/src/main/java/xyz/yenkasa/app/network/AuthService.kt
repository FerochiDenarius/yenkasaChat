package xyz.yenkasa.app.network

import xyz.yenkasa.app.model.LoginRequest
import xyz.yenkasa.app.model.LoginResponse
import xyz.yenkasa.app.model.RegisterRequest
import xyz.yenkasa.app.model.RefreshTokenRequest
import xyz.yenkasa.app.model.TokenResponse
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Path

interface AuthService {

    // ✅ POST /api/auth/register
    @POST("auth/register")
    fun registerUser(
        @Body request: RegisterRequest
    ): Call<LoginResponse>

    // ✅ POST /api/auth/login
    @POST("auth/login")
    fun login(
        @Body request: LoginRequest
    ): Call<LoginResponse>


    // ✅ PATCH /api/users/{userId}/player-id (NEWLY ADDED)
    @PATCH("users/{userId}/player-id")
    fun updatePlayerId(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<Void>

    @POST("auth/token/refresh")
    fun refreshToken(
        @Body request: RefreshTokenRequest
    ): Call<TokenResponse>


}
