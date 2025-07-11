package com.example.yenkasachat.network

import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.model.RegisterRequest
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.PATCH
import retrofit2.http.Path


interface AuthService {

    // ✅ Register a new user
    @POST("/api/auth/register")
    fun registerUser(
        @Body request: RegisterRequest
    ): Call<LoginResponse>

    // ✅ Login using identifier and password
    @POST("/api/auth/login")
    fun login(
        @Body request: LoginRequest
    ): Call<LoginResponse>

    // ✅ Request email verification
    @POST("/api/verify/request")
    fun requestEmailVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    // ✅ Request phone verification
    @POST("/api/verify/request-phone")
    fun requestPhoneVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @PATCH("users/{userId}/fcm-token")
    fun updateFcmToken(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<Void>


    // ✅ Confirm verification code
    @POST("/api/verify/confirm")
    fun confirmVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>
}
