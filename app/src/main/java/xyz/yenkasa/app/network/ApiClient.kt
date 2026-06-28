package xyz.yenkasa.app.network

import android.content.Context
import com.google.gson.GsonBuilder
import xyz.yenkasa.app.model.Role
import xyz.yenkasa.app.model.UserBasic
import xyz.yenkasa.app.model.RefreshTokenRequest
import xyz.yenkasa.app.util.TokenManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.IOException
import java.util.concurrent.TimeUnit

object ApiClient {
    const val BASE_URL = "https://www.yenkasa.xyz/api/"

    private lateinit var retrofit: Retrofit
    private lateinit var uploadRetrofit: Retrofit
    private var initialized = false
    private val gson by lazy {
        GsonBuilder()
            .registerTypeAdapter(UserBasic::class.java, UserBasicJsonAdapter())
            .registerTypeAdapter(Role::class.java, RoleJsonAdapter())
            .create()
    }

    val apiService: ApiService by lazy {
        getClient().create(ApiService::class.java)
    }

    val authService: AuthService by lazy {
        getClient().create(AuthService::class.java)
    }

    val uploadApiService: ApiService by lazy {
        getUploadClient().create(ApiService::class.java)
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

                val isPasswordResetRequest = url.contains("reset-password/")

                // Password reset endpoints are public. Do not attach stale auth tokens
                // and do not trigger refresh-token handling for logged-out users.
                if (!isPasswordResetRequest) {
                    val token = TokenManager.getToken(applicationContext)
                    token?.let { requestBuilder.header("Authorization", "Bearer $it") }
                }

                var response = chain.proceed(requestBuilder.build())

                if (response.code == 401 && !url.contains("auth/refresh-token") && !isPasswordResetRequest) {
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
                                .addConverterFactory(GsonConverterFactory.create(gson))
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
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()

        val uploadHttpClient = httpClient.newBuilder()
            .readTimeout(240, TimeUnit.SECONDS)
            .writeTimeout(240, TimeUnit.SECONDS)
            .callTimeout(300, TimeUnit.SECONDS)
            .build()

        retrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(httpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()

        uploadRetrofit = Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(uploadHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()

        initialized = true
    }

    private fun getClient(): Retrofit {
        if (!initialized || !::retrofit.isInitialized) {
            throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
        }
        return retrofit
    }

    private fun getUploadClient(): Retrofit {
        if (!initialized || !::uploadRetrofit.isInitialized) {
            throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
        }
        return uploadRetrofit
    }

    @Synchronized
    fun reset() {
        initialized = false
    }
}
