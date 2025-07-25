package com.example.yenkasachat.network

import android.content.Context
import android.util.Log
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
                val requestBuilder = chain.request().newBuilder()

                val token = TokenManager.getToken(context)
                if (!token.isNullOrEmpty()) {
                    requestBuilder.addHeader("Authorization", "Bearer $token")
                    Log.d("ApiClient", "🔐 Token attached: Bearer $token")
                } else {
                    Log.w("ApiClient", "⚠️ No token found in TokenManager")
                }

                chain.proceed(requestBuilder.build())
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
        get() = if (::retrofit.isInitialized) retrofit else throw IllegalStateException("ApiClient not initialized. Call ApiClient.init(context) first.")
}
