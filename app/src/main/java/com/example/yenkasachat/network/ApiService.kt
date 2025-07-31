package com.example.yenkasachat.network

import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.PushNotificationRequest
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response // Ensure this is imported for suspend functions
import retrofit2.http.*

interface ApiService {

    // --- Authentication ---
    @POST("/api/auth/login") // This path includes "/api/"
    fun login(
        @Body request: LoginRequest
    ): Call<LoginResponse>

    @POST("/api/auth/forgot-password") // This path includes "/api/"
    @FormUrlEncoded
    suspend fun forgotPassword(
        @Field("email") email: String
    ): Response<Void>

    // --- Users ---
    @GET("/api/users") // This path includes "/api/"
    fun getAllUsers(): Call<List<User>>

    @Multipart
    @POST("/api/users/profile-picture") // This path includes "/api/"
    fun uploadProfilePicture(
        @Part image: MultipartBody.Part
    ): Call<Map<String, Any>>

    @GET("/api/users/me") // This path includes "/api/"
    fun getUserProfile(): Call<User>

    @PATCH("/api/users/{userId}/player-id") // This path includes "/api/"
    fun updatePlayerId(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<ResponseBody>

    @PATCH("/api/users/{userId}/fcm-token") // This path includes "/api/"
    fun updateFcmToken(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<Void>

    // --- Chat Rooms ---
    @POST("/api/chatrooms") // This path includes "/api/"
    fun createChatRoom(
        @Body body: Map<String, String>
    ): Call<CreateChatRoomResponse>

    @GET("/api/chatrooms") // This path includes "/api/"
    fun getChatRooms(): Call<List<ChatRoom>>

    @GET("/api/chatrooms/user/{userId}") // This path includes "/api/"
    fun getUserChatRooms(
        @Path("userId") userId: String
    ): Call<List<ChatRoom>>

    @POST("/api/chatroom/{receiverId}") // This path includes "/api/"
    fun getOrCreateChatRoom(
        @Path("receiverId") receiverId: String
    ): Call<CreateChatRoomResponse>

    // --- Messages ---
    @POST("/api/messages") // This path includes "/api/"
    fun sendMessage(
        @Body body: Map<String, @JvmSuppressWildcards Any?>
    ): Call<ChatMessage>

    @GET("/api/messages/{roomId}") // This path includes "/api/"
    fun getMessages(
        @Path("roomId") roomId: String
    ): Call<List<ChatMessage>>

    // --- Contacts ---
    @POST("/api/contacts") // This path includes "/api/"
    fun addContact(
        @Body body: Map<String, String>
    ): Call<Contact>

    @GET("/api/contacts") // This path includes "/api/"
    fun getContacts(): Call<List<Contact>>

    @DELETE("/api/contacts/{contactId}") // This path includes "/api/"
    fun deleteContact(
        @Path("contactId") contactId: String
    ): Call<Void>

    // --- Push Notifications ---
    @POST("/api/notify") // This path includes "/api/"
    fun sendPushNotification(
        @Body request: PushNotificationRequest
    ): Call<Void>

    // --- Verification --- (These seem to be correctly under /api/verify/ as well)
    @POST("/api/verify/request") // This path includes "/api/"
    fun requestEmailVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @POST("/api/verify/request-phone") // This path includes "/api/"
    fun requestPhoneVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @POST("/api/verify/confirm") // This path includes "/api/"
    fun confirmVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>
}
