package com.example.yenkasachat.network

import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomRequest
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.model.PushNotificationRequest
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.ForgotPasswordRequest
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response // Ensure this is imported for suspend functions
import retrofit2.http.*

interface ApiService {


    @POST("auth/login")
    fun login(
        @Body request: LoginRequest
    ): Call<LoginResponse>

    @POST("api/forgot-password/forgot-password")
    suspend fun forgotPassword(
        @Body request: ForgotPasswordRequest
    ): Response<Void>

    // --- Users ---
    @GET("users")
    fun getAllUsers(): Call<List<User>>

    @Multipart
    @POST("users/profile-picture")
    fun uploadProfilePicture(
        @Part image: MultipartBody.Part
    ): Call<Map<String, Any>>

    @GET("users/me")
    fun getUserProfile(): Call<User>

    @PATCH("users/{userId}/player-id")
    fun updatePlayerId(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<ResponseBody>

    @PATCH("users/{userId}/fcm-token")
    fun updateFcmToken(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<Void>

    // --- Chat Rooms ---
    @POST("chatrooms")
    fun createChatRoom(@Body request: CreateChatRoomRequest): Call<CreateChatRoomResponse>

    @GET("chatrooms")
    fun getChatRooms(): Call<List<ChatRoom>>

    @GET("chatrooms/user/{userId}")
    fun getUserChatRooms(
        @Path("userId") userId: String
    ): Call<List<ChatRoom>>

    @POST("chatroom/{receiverId}")
    fun getOrCreateChatRoom(
        @Path("receiverId") receiverId: String
    ): Call<CreateChatRoomResponse>

    // --- Messages ---
    @POST("messages")
    fun sendMessage(
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Call<ChatMessage>

    @GET("messages/{roomId}")
    fun getMessages(
        @Path("roomId") roomId: String
    ): Call<List<ChatMessage>> // Now only expects roomId

    // --- Contacts ---
    @POST("contacts")
    fun addContact(
        @Body body: Map<String, String>
    ): Call<Contact>

    @GET("contacts")
    fun getContacts(): Call<List<Contact>>

    @DELETE("contacts/{contactId}")
    fun deleteContact(
        @Path("contactId") contactId: String
    ): Call<Void>

    // --- Push Notifications ---
    @POST("notify")
    fun sendPushNotification(
        @Body request: PushNotificationRequest
    ): Call<Void>

    // --- Verification ---
    @POST("verify/request")
    fun requestEmailVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @POST("verify/request-phone")
    fun requestPhoneVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @POST("verify/confirm")
    fun confirmVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>
}
