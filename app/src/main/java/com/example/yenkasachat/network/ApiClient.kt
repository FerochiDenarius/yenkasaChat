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
import java.io.IOException // Import IOException

object ApiClient {
    public const val BASE_URL = "https://yenkasa-bldrv.ondigitalocean.app/api/"

    private lateinit var retrofit: Retrofit
    private var initialized = false

    // Using lazy initialization for services is a good practice
    val apiService: ApiService by lazy {
        getClient().create(ApiService::class.java)
    }

    val authService: AuthService by lazy {
        getClient().create(AuthService::class.java)
    }


    private lateinit var applicationContext: Context


    @Synchronized // Ensure thread-safe initialization
    fun init(context: Context) {
        if (initialized) return
        applicationContext = context.applicationContext // Use application context to avoid leaks

        // 1. Create the Logging Interceptor
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY // Or Level.HEADERS for less verbosity
        }

        // 2. Create the Authentication Interceptor (handles token attachment and refresh)
        val authInterceptor = object : Interceptor {
            @Throws(IOException::class)
            override fun intercept(chain: Interceptor.Chain): Response {
                val originalRequest = chain.request()
                val requestBuilder = originalRequest.newBuilder()

                // Attach current token
                val currentToken = TokenManager.getToken(applicationContext)
                Log.d("ApiClientVerbose", "Token from TokenManager for request ${originalRequest.url}: $currentToken")

                currentToken?.let { token ->
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                    Log.d("ApiClient", "🔐 Token attached to ${originalRequest.url}: Bearer $token")
                }

                var response = chain.proceed(requestBuilder.build())

                // Check for 401 Unauthorized for token refresh
                if (response.code == 401) {
                    val previousTokenUsed = currentToken // Token that resulted in 401
                    response.close() // Close the original response before retrying
                    Log.w("ApiClient", "🛑 Token expired or invalid (401). Attempting to refresh...")

                    val refreshToken = TokenManager.getRefreshToken(applicationContext)
                    if (!refreshToken.isNullOrEmpty()) {
                        synchronized(this) { // Synchronize token refresh block
                            // Check if token was already refreshed by another thread while waiting for synchronized block
                            val tokenAfterSync = TokenManager.getToken(applicationContext)
                            if (previousTokenUsed != null && previousTokenUsed != tokenAfterSync) {
                                Log.i("ApiClient", "Token already refreshed by another thread. Retrying with new token.")
                                val newRequestBuilder = originalRequest.newBuilder()
                                    .removeHeader("Authorization") // Remove old one just in case
                                    .addHeader("Authorization", "Bearer $tokenAfterSync")
                                    .build()
                                return chain.proceed(newRequestBuilder) // Retry with potentially new token
                            }

                            // Proceed with refresh
                            try {
                                Log.d("ApiClient", "🔄 Attempting token refresh with refreshToken: $refreshToken")
                                // Create a new Retrofit client for the refresh token call
                                // to avoid circular interceptor calls if the refresh endpoint itself needs auth (it shouldn't)
                                val refreshRetrofit = Retrofit.Builder()
                                    .baseUrl(BASE_URL)
                                    .addConverterFactory(GsonConverterFactory.create())
                                    .client(OkHttpClient.Builder().addInterceptor(loggingInterceptor).build()) // Can add logging here too if needed
                                    .build()
                                val refreshAuthService = refreshRetrofit.create(AuthService::class.java)

                                val refreshCall = refreshAuthService.refreshToken(RefreshTokenRequest(refreshToken))
                                val refreshResponse = refreshCall.execute() // Synchronous call for simplicity in interceptor

                                if (refreshResponse.isSuccessful) {
                                    val newTokens = refreshResponse.body()
                                    val newAccessToken = newTokens?.token
                                    val newRefreshToken = newTokens?.refreshToken // Some APIs send back a new refresh token

                                    if (!newAccessToken.isNullOrEmpty()) {
                                        TokenManager.saveToken(applicationContext, newAccessToken)
                                        Log.i("ApiClient", "✅ Access token refreshed successfully.")

                                        if (!newRefreshToken.isNullOrEmpty()) {
                                            TokenManager.saveRefreshToken(applicationContext, newRefreshToken)
                                            Log.i("ApiClient", "🔄 Refresh token was also updated.")
                                        }

                                        // Retry the original request with the new token
                                        val newRequestWithRefreshedToken = originalRequest.newBuilder()
                                            .removeHeader("Authorization") // Remove old one
                                            .addHeader("Authorization", "Bearer $newAccessToken")
                                            .build()
                                        return chain.proceed(newRequestWithRefreshedToken)
                                    } else {
                                        Log.e("ApiClient", "❌ Refresh response missing new access token.")

                                    }
                                } else {
                                    Log.e("ApiClient", "❌ Token refresh failed. Code: ${refreshResponse.code()}, Message: ${refreshResponse.message()}")
                                    Log.e("ApiClient", "Error body: ${refreshResponse.errorBody()?.string()}")
                                    // If refresh fails (e.g., 401/403 on refresh token), clear tokens and navigate to login
                                    if (refreshResponse.code() == 401 || refreshResponse.code() == 403) {
                                        TokenManager.clearAll(applicationContext) // Or your method to clear all tokens
                                        Log.e("ApiClient", "Refresh token is invalid. Tokens cleared. User should re-login.")
                                        // Here you might want to broadcast an event or use a callback to trigger re-login
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

                return response // Return the original response if not 401 or if refresh failed to produce a new request
            }
        }



        val httpClient = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)       // Handles token attachment and refresh logic
            .addInterceptor(loggingInterceptor)    // Logs the network traffic

            .build()

        // 4. Build Retrofit instance
        retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        initialized = true
    }

    // Private fun to get client, ensures init is called
    private fun getClient(): Retrofit {
        if (!initialized || !::retrofit.isInitialized) {
            throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
        }
        return retrofit
    }

    // Optional: A way to reset for testing or logout
    @Synchronized
    fun reset() {
        initialized = false
        // Potentially clear retrofit instance if needed, though lazy properties will re-init
    }
}
