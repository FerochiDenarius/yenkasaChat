package com.example.yenkasachat.network

import android.content.Context
import android.util.Log
import com.example.yenkasachat.model.RefreshTokenRequest
import com.example.yenkasachat.util.TokenManager
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    private const val BASE_URL = "https://yenkasachat.onrender.com/api/"

    private lateinit var retrofit: Retrofit
    private var initialized = false

    lateinit var apiService: ApiService
        private set

    lateinit var authService: AuthService
        private set

    fun init(context: Context) {
        if (initialized) return

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val httpClient = OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .addInterceptor { chain ->
                val originalRequest = chain.request()
                val requestBuilder = originalRequest.newBuilder()

                // Attach current token
                TokenManager.getToken(context)?.let { token ->
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                    Log.d("ApiClient", "🔐 Token attached: Bearer $token")
                }

                var response = chain.proceed(requestBuilder.build())

                if (response.code == 401) {
                    response.close()
                    Log.w("ApiClient", "🛑 Token expired. Attempting to refresh...")

                    val refreshToken = TokenManager.getRefreshToken(context)

                    if (!refreshToken.isNullOrEmpty()) {
                        try {
                            val refreshRetrofit = Retrofit.Builder()
                                .baseUrl(BASE_URL)
                                .addConverterFactory(GsonConverterFactory.create())
                                .build()

                            val refreshService = refreshRetrofit.create(AuthService::class.java)
                            val refreshCall = refreshService.refreshToken(RefreshTokenRequest(refreshToken))
                            val refreshResponse = refreshCall.execute()

                            if (refreshResponse.isSuccessful) {
                                val newToken = refreshResponse.body()?.token
                                val newRefreshToken = refreshResponse.body()?.refreshToken

                                if (!newToken.isNullOrEmpty()) {
                                    TokenManager.saveToken(context, newToken)
                                    Log.i("ApiClient", "✅ Access token refreshed.")

                                    if (!newRefreshToken.isNullOrEmpty()) {
                                        TokenManager.saveRefreshToken(context, newRefreshToken)
                                        Log.i("ApiClient", "🔄 Refresh token updated.")
                                    }

                                    // Retry the original request with new token
                                    val newRequest = originalRequest.newBuilder()
                                        .removeHeader("Authorization")
                                        .addHeader("Authorization", "Bearer $newToken")
                                        .build()

                                    return@addInterceptor chain.proceed(newRequest)
                                } else {
                                    Log.e("ApiClient", "❌ Refresh response missing new token.")
                                }
                            } else {
                                Log.e("ApiClient", "❌ Refresh failed with code ${refreshResponse.code()}")
                            }
                        } catch (e: Exception) {
                            Log.e("ApiClient", "🔥 Token refresh error: ${e.localizedMessage}", e)
                        }
                    } else {
                        Log.e("ApiClient", "🚫 No refresh token found.")
                    }
                }

                return@addInterceptor response
            }
            .build()

        retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        apiService = retrofit.create(ApiService::class.java)
        authService = retrofit.create(AuthService::class.java)

        initialized = true
    }

    val retrofitInstance: Retrofit
        get() = if (::retrofit.isInitialized) retrofit
        else throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
}
