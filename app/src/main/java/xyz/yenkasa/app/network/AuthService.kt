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

    // ✅ POST /api/auth/verify/request
    @POST("auth/verify/request")
    fun requestEmailVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>


    // ✅ POST /api/auth/verify/request-phone
    @POST("auth/verify/request-phone")
    fun requestPhoneVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    // ✅ PATCH /api/users/{userId}/fcm-token
    @PATCH("users/{userId}/fcm-token")
    fun updateFcmToken(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<Void>

    // ✅ POST /api/auth/verify/confirm
    @POST("auth/verify/confirm")
    fun confirmVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

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
