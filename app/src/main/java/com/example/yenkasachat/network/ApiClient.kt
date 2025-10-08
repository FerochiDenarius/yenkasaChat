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

    val dailyApi: ApiService by lazy {
        getClient().create(ApiService::class.java)
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

                // Skip token for reset endpoints
                if (!url.contains("reset-password/confirm") && !url.contains("reset-password/verify")) {
                    val token = TokenManager.getToken(applicationContext)
                    token?.let { requestBuilder.header("Authorization", "Bearer $it") }
                }

                var response = chain.proceed(requestBuilder.build())

                if (response.code == 401 && !url.contains("auth/refresh-token")) {
                    response.close() // Close old response

                    val refreshToken = TokenManager.getRefreshToken(applicationContext)
                    if (refreshToken.isNullOrEmpty()) {
                        TokenManager.clearAll(applicationContext)
                        throw IOException("Refresh token missing. User must login again.")
                    }

                    synchronized(this) {
                        // Check if another thread already refreshed the token
                        val currentToken = TokenManager.getToken(applicationContext)
                        val currentAuthHeader = "Bearer $currentToken"
                        if (originalRequest.header("Authorization") != currentAuthHeader) {
                            val newRequest = originalRequest.newBuilder()
                                .header("Authorization", currentAuthHeader)
                                .build()
                            return chain.proceed(newRequest)
                        }

                        // Perform refresh token call
                        try {
                            val refreshRetrofit = Retrofit.Builder()
                                .baseUrl(BASE_URL)
                                .addConverterFactory(GsonConverterFactory.create())
                                .build()
                            val refreshService = refreshRetrofit.create(AuthService::class.java)
                            val refreshResponse = refreshService.refreshToken(RefreshTokenRequest(refreshToken)).execute()

                            if (refreshResponse.isSuccessful) {
                                val newTokens = refreshResponse.body()
                                val newAccess = newTokens?.token
                                val newRefresh = newTokens?.refreshToken

                                if (newAccess.isNullOrEmpty()) {
                                    TokenManager.clearAll(applicationContext)
                                    throw IOException("Refresh returned empty access token.")
                                }

                                TokenManager.saveToken(applicationContext, newAccess)
                                newRefresh?.let { TokenManager.saveRefreshToken(applicationContext, it) }

                                // Retry original request
                                val newRequest = originalRequest.newBuilder()
                                    .header("Authorization", "Bearer $newAccess")
                                    .build()
                                return chain.proceed(newRequest)
                            } else {
                                TokenManager.clearAll(applicationContext)
                                throw IOException("Refresh failed with code ${refreshResponse.code()}")
                            }
                        } catch (e: Exception) {
                            TokenManager.clearAll(applicationContext)
                            throw IOException("Exception during token refresh: ${e.message}", e)
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