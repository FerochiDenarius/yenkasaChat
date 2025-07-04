package com.example.yenkasachat.network

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {
    // ✅ Replace this with your current ngrok HTTPS URL

    private const val BASE_URL = "https://yenkasachat.onrender.com"
    // ✅ Logging interceptor for debugging network requests/responses
    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    // ✅ OkHttpClient with logging enabled
    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .build()

    // ✅ Retrofit client setup
    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL) // Must end with '/'
        .addConverterFactory(GsonConverterFactory.create())
        .client(httpClient)
        .build()

    // ✅ Services
    val apiService: ApiService = retrofit.create(ApiService::class.java)
    val authService: AuthService = retrofit.create(AuthService::class.java)
}
