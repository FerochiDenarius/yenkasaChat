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
                    currentToken?.let { token ->
                        requestBuilder.addHeader("Authorization", "Bearer $token")
                        Log.d("ApiClient", "🔐 Token attached to $url: Bearer $token")
                    }
                } else {
                    Log.d("ApiClient", "⏭️ Skipping token for request: $url")
                }

                var response = chain.proceed(requestBuilder.build())

                // 🔄 Handle expired access token (401)
// Inside your authInterceptor in ApiClient.kt

// ... (request building and initial chain.proceed(request) part is fine) ...

// 🔄 Handle expired access token (401)
                if (response.code == 401 && !originalRequest.url.toString().contains("auth/refresh-token")) { // Added check to avoid loop on refresh-token itself
                    val currentTokenUsedInFailedRequest = originalRequest.header("Authorization") // More reliable than getToken() again
                    response.close() // Close the previous response body before proceeding
                    Log.w("ApiClient", "🛑 Token expired or invalid (401) for ${originalRequest.url}. Attempting to refresh...")

                    val refreshTokenString = TokenManager.getRefreshToken(applicationContext)

                    if (refreshTokenString.isNullOrEmpty()) {
                        Log.e("ApiClient", "🚫 No refresh token found. Cannot refresh access token. Logging out.")
                        TokenManager.clearAll(applicationContext)
                        // TODO: Notify UI to navigate to login (e.g., using a BroadcastReceiver, LiveData/StateFlow in a ViewModel)
                        return response // Return the original 401 response
                    }

                    synchronized(this) {
                        // Double-check if the token was refreshed by another thread while this one was waiting
                        val tokenAfterSync = TokenManager.getToken(applicationContext)
                        val authHeaderAfterSync = tokenAfterSync?.let { "Bearer $it" }

                        if (currentTokenUsedInFailedRequest != null && authHeaderAfterSync != null && currentTokenUsedInFailedRequest != authHeaderAfterSync) {
                            Log.i("ApiClient", "Token already refreshed by another thread. Retrying original request with new token: $authHeaderAfterSync")
                            val newRequestBuilderWithAlreadyRefreshedToken = originalRequest.newBuilder()
                                .header("Authorization", authHeaderAfterSync) // Use the most recent token
                                .build()
                            return chain.proceed(newRequestBuilderWithAlreadyRefreshedToken)
                        }

                        // Proceed to refresh the token
                        Log.d("ApiClient", "Attempting to refresh token using: $refreshTokenString")
                        try {
                            // It's good practice to use a separate OkHttpClient for refresh
                            // to avoid interceptor loops if you had more complex interceptors.
                            // Your current setup of a new Retrofit instance for refresh is fine.
                            val refreshRetrofit = Retrofit.Builder()
                                .baseUrl(BASE_URL)
                                .addConverterFactory(GsonConverterFactory.create())
                                // Optionally, add a specific logging interceptor for refresh calls if needed
                                // .client(OkHttpClient.Builder().addInterceptor(loggingInterceptor).build())
                                .build()
                            val refreshAuthService = refreshRetrofit.create(AuthService::class.java)

                            val refreshCall = refreshAuthService.refreshToken(RefreshTokenRequest(refreshTokenString))
                            val refreshApiResponse: retrofit2.Response<TokenResponse> = refreshCall.execute() // Explicit type

                            if (refreshApiResponse.isSuccessful) {
                                val newTokens = refreshApiResponse.body() // Type is TokenResponse?

                                if (newTokens?.token != null && newTokens.token.isNotEmpty()) {
                                    val newAccessToken = newTokens.token
                                    TokenManager.saveToken(applicationContext, newAccessToken)
                                    Log.i("ApiClient", "✅ Token refresh successful. New access token saved.")

                                    // Handle new refresh token ONLY if server sends it and it's different
                                    if (newTokens.refreshToken.isNotEmpty() && newTokens.refreshToken != refreshTokenString) {
                                        TokenManager.saveRefreshToken(applicationContext, newTokens.refreshToken)
                                        Log.i("ApiClient", "🔑 New refresh token also saved.")
                                    }

                                    Log.i("ApiClient", "Retrying original request (${originalRequest.url}) with new access token.")
                                    val newRequestWithRefreshedToken = originalRequest.newBuilder()
                                        .header("Authorization", "Bearer $newAccessToken")
                                        .build()
                                    return chain.proceed(newRequestWithRefreshedToken)
                                } else {
                                    Log.e("ApiClient", "🚨 Refresh API call successful, but new access token in response was null or empty. Body: ${newTokens}. Logging out.")
                                    TokenManager.clearAll(applicationContext)
                                    // TODO: Notify UI to navigate to login
                                    // Return the original 401 response as we couldn't recover.
                                    // Or, you could construct a new response indicating a specific refresh failure.
                                    // For simplicity, returning original 401 is okay if UI handles it by going to login.
                                    return response // Return original 401
                                }
                            } else {
                                // Refresh call itself failed (e.g., 401/403 on refresh token, 500 server error)
                                val errorCode = refreshApiResponse.code()
                                val errorBody = refreshApiResponse.errorBody()?.string() ?: "No error body"
                                Log.e("ApiClient", "🚨 Token refresh API call failed. Code: $errorCode, ErrorBody: $errorBody")

                                if (errorCode == 401 || errorCode == 403) {
                                    Log.e("ApiClient", "Refresh token is invalid or expired as per server. Clearing all tokens and logging out.")
                                    TokenManager.clearAll(applicationContext)
                                    // TODO: Notify UI to navigate to login
                                }
                                // For other errors (e.g., 500), we might not log out immediately.
                                // The original 401 response will be returned.
                                return response // Return original 401
                            }
                        } catch (e: Exception) {
                            Log.e("ApiClient", "🔥 Exception during token refresh process: ${e.message}", e)
                            // It's generally safer to assume we can't recover if an unexpected exception occurs during refresh.
                            // Consider if logout is appropriate here.
                            // TokenManager.clearAll(applicationContext)
                            // TODO: Notify UI to navigate to login
                            return response // Return original 401
                        }
                    }
                }

// Return the original response if not 401 or if refresh logic didn't return earlier
                return response

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
