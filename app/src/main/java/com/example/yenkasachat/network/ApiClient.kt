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
                    currentToken?.let { token ->
                        requestBuilder.addHeader("Authorization", "Bearer $token")
                        Log.d("ApiClient", "🔐 Token attached to $url: Bearer $token")
                    }
                } else {
                    Log.d("ApiClient", "⏭️ Skipping token for request: $url")
                }

                var response = chain.proceed(requestBuilder.build())

                // 🔄 Handle expired access token (401)
                if (response.code == 401) {
                    val currentToken = TokenManager.getToken(applicationContext)
                    response.close()
                    Log.w("ApiClient", "🛑 Token expired or invalid (401). Attempting to refresh...")

                    val refreshToken = TokenManager.getRefreshToken(applicationContext)
                    if (!refreshToken.isNullOrEmpty()) {
                        synchronized(this) {
                            val tokenAfterSync = TokenManager.getToken(applicationContext)
                            if (currentToken != null && currentToken != tokenAfterSync) {
                                Log.i("ApiClient", "Token already refreshed by another thread. Retrying with new token.")
                                val newRequestBuilder = originalRequest.newBuilder()
                                    .removeHeader("Authorization")
                                    .addHeader("Authorization", "Bearer $tokenAfterSync")
                                    .build()
                                return chain.proceed(newRequestBuilder)
                            }

                            try {
                                val refreshRetrofit = Retrofit.Builder()
                                    .baseUrl(BASE_URL)
                                    .addConverterFactory(GsonConverterFactory.create())
                                    .client(OkHttpClient.Builder().addInterceptor(loggingInterceptor).build())
                                    .build()
                                val refreshAuthService = refreshRetrofit.create(AuthService::class.java)

                                val refreshCall = refreshAuthService.refreshToken(RefreshTokenRequest(refreshToken))
                                val refreshResponse = refreshCall.execute()

                                if (refreshResponse.isSuccessful) {
                                    val newTokens = refreshResponse.body()
                                    val newAccessToken = newTokens?.token
                                    val newRefreshToken = newTokens?.refreshToken

                                    if (!newAccessToken.isNullOrEmpty()) {
                                        TokenManager.saveToken(applicationContext, newAccessToken)
                                        if (!newRefreshToken.isNullOrEmpty()) {
                                            TokenManager.saveRefreshToken(applicationContext, newRefreshToken)
                                        }

                                        val newRequestWithRefreshedToken = originalRequest.newBuilder()
                                            .removeHeader("Authorization")
                                            .addHeader("Authorization", "Bearer $newAccessToken")
                                            .build()
                                        return chain.proceed(newRequestWithRefreshedToken)
                                    }
                                } else {
                                    if (refreshResponse.code() == 401 || refreshResponse.code() == 403) {
                                        TokenManager.clearAll(applicationContext)
                                        Log.e("ApiClient", "Refresh token invalid. Cleared tokens.")
                                    }
                                }
                            } catch (e: Exception) {
                                Log.e("ApiClient", "🔥 Exception during token refresh: ${e.message}", e)
                            }
                        }
                    } else {
                        Log.e("ApiClient", "🚫 No refresh token found. Cannot refresh access token.")
                    }
                }

                // ✅ Return the response (original or retried)
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
