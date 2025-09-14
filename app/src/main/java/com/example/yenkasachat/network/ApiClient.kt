package com.example.yenkasachat.network

import android.content.Context
import android.util.Log
import com.example.yenkasachat.model.RefreshTokenRequest
import com.example.yenkasachat.util.TokenManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import com.example.yenkasachat.model.TokenResponse

object ApiClient {
    const val BASE_URL = "https://yenkasa-bldrv.ondigitalocean.app/api/"

    private lateinit var retrofit: Retrofit
    private var initialized = false

    val apiService: ApiService by lazy {
        getClient().create(ApiService::class.java)
    }

    val authService: AuthService by lazy {
        getClient().create(AuthService::class.java)
    }

    private lateinit var applicationContext: Context

    @Synchronized
    fun init(context: Context) {
        if (initialized) return
        applicationContext = context.applicationContext

        // Logging interceptor
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        // Authentication interceptor
        val authInterceptor = object : Interceptor {
            @Throws(IOException::class)
            override fun intercept(chain: Interceptor.Chain): Response {
                val originalRequest = chain.request()
                val url = originalRequest.url.toString()
                val requestBuilder = originalRequest.newBuilder()

                // 🚫 Skip attaching Authorization for password reset endpoints
                if (!url.contains("reset-password/confirm") &&
                    !url.contains("reset-password/verify")
                ) {
                    val currentToken = TokenManager.getToken(applicationContext)
                    Log.d("ApiClientVerbose", "Token for request $url: $currentToken")

                    if (!currentToken.isNullOrBlank()) {
                        requestBuilder.addHeader("Authorization", "Bearer $currentToken")
                        Log.d("ApiClient", "🔐 Token attached to $url")
                    } else {
                        Log.w("ApiClient", "⚠️ No access token found. Sending request without Authorization header.")
                    }
                } else {
                    Log.d("ApiClient", "⏭️ Skipping token for request: $url")
                }

                var response = chain.proceed(requestBuilder.build())

                // 🔄 Handle expired access token (401)
                if (response.code == 401 &&
                    !originalRequest.url.toString().contains("auth/refresh-token")
                ) {
                    val currentTokenUsedInFailedRequest = originalRequest.header("Authorization")
                    response.close() // Always close before retry
                    Log.w("ApiClient", "🛑 Token expired or invalid (401) for ${originalRequest.url}. Attempting to refresh...")

                    val refreshTokenString = TokenManager.getRefreshToken(applicationContext)

                    if (refreshTokenString.isNullOrEmpty()) {
                        Log.e("ApiClient", "🚫 No refresh token found. Cannot refresh access token. Logging out.")
                        TokenManager.clearAll(applicationContext)
                        return response
                    }

                    synchronized(this) {
                        val tokenAfterSync = TokenManager.getToken(applicationContext)
                        val authHeaderAfterSync = tokenAfterSync?.let { "Bearer $it" }

                        if (currentTokenUsedInFailedRequest != null &&
                            authHeaderAfterSync != null &&
                            currentTokenUsedInFailedRequest != authHeaderAfterSync
                        ) {
                            Log.i("ApiClient", "Token already refreshed by another thread. Retrying with new token.")
                            val newRequest = originalRequest.newBuilder()
                                .header("Authorization", authHeaderAfterSync)
                                .build()
                            return chain.proceed(newRequest)
                        }

                        try {
                            val refreshRetrofit = Retrofit.Builder()
                                .baseUrl(BASE_URL)
                                .addConverterFactory(GsonConverterFactory.create())
                                .build()
                            val refreshAuthService = refreshRetrofit.create(AuthService::class.java)

                            val refreshCall = refreshAuthService.refreshToken(
                                RefreshTokenRequest(refreshTokenString)
                            )
                            val refreshApiResponse = refreshCall.execute()

                            if (refreshApiResponse.isSuccessful) {
                                val newTokens = refreshApiResponse.body()
                                if (!newTokens?.token.isNullOrEmpty()) {
                                    val newAccessToken = newTokens!!.token
                                    TokenManager.saveToken(applicationContext, newAccessToken)
                                    Log.i("ApiClient", "✅ Token refresh successful. New access token saved.")

                                    if (!newTokens.refreshToken.isNullOrEmpty() &&
                                        newTokens.refreshToken != refreshTokenString
                                    ) {
                                        TokenManager.saveRefreshToken(applicationContext, newTokens.refreshToken)
                                        Log.i("ApiClient", "🔑 New refresh token also saved.")
                                    }

                                    val newRequest = originalRequest.newBuilder()
                                        .header("Authorization", "Bearer $newAccessToken")
                                        .build()
                                    return chain.proceed(newRequest)
                                } else {
                                    Log.e("ApiClient", "🚨 Refresh succeeded but returned empty token. Logging out.")
                                    TokenManager.clearAll(applicationContext)
                                    return response
                                }
                            } else {
                                val errorCode = refreshApiResponse.code()
                                val errorBody = refreshApiResponse.errorBody()?.string() ?: "No error body"
                                Log.e("ApiClient", "🚨 Refresh API failed. Code: $errorCode, Body: $errorBody")

                                if (errorCode == 401 || errorCode == 403) {
                                    TokenManager.clearAll(applicationContext)
                                }
                                return response
                            }
                        } catch (e: Exception) {
                            Log.e("ApiClient", "🔥 Exception during token refresh: ${e.message}", e)
                            return response
                        }
                    }
                }

                return response
            }
        }

        val httpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()

        retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        initialized = true
    }

    private fun getClient(): Retrofit {
        if (!initialized || !::retrofit.isInitialized) {
            throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
        }
        return retrofit
    }

    @Synchronized
    fun reset() {
        initialized = false
    }
}