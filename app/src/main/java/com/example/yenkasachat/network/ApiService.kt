package com.example.yenkasachat.network

import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomRequest
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.model.LoginRequest
import com.example.yenkasachat.model.LoginResponse
import com.example.yenkasachat.model.UnreadCountRequest
import com.example.yenkasachat.model.UnreadCountResponse
import com.example.yenkasachat.model.RoomUnreadCountResponse
import com.example.yenkasachat.model.AllUnreadCountsResponse
import com.example.yenkasachat.model.PushNotificationRequest
import com.example.yenkasachat.model.User
import com.example.yenkasachat.model.Participant
import com.example.yenkasachat.model.ReceiverResponse
import com.example.yenkasachat.model.ProfileResponse
import com.example.yenkasachat.model.UpdateProfileRequest
import com.example.yenkasachat.model.ForgotPasswordRequest
import com.example.yenkasachat.model.VerificationResponse
import com.example.yenkasachat.model.EmailRequest
import com.example.yenkasachat.model.ConfirmRequest
import com.example.yenkasachat.model.PhoneRequest
import com.example.yenkasachat.model.ConfirmPhoneRequest
import com.example.yenkasachat.model.Post
import com.example.yenkasachat.network.model.ToggleLikeResponse
import com.example.yenkasachat.model.ResetPasswordRequest
import com.example.yenkasachat.model.Comment
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response // Ensure this is imported for suspend functions
import retrofit2.http.*
import okhttp3.RequestBody
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part



// --- Data classes for Unread Count feature ---

data class UnreadCountRequest(
    val userId: String,
    val roomId: String
)


// Daily.co API Models
data class CreateRoomRequest(val roomName: String)
data class CreateRoomResponse(val roomName: String, val roomUrl: String)

// 🔥 FIXED: use _id instead of userId to match backend
data class GenerateTokenRequest(
    val roomName: String,
    val _id: String
)

data class GenerateTokenResponse(
    val token: String,
    val roomName: String
)


data class UnreadCountData(
    val userId: String,
    val roomId: String,
    val count: Int,
    val updatedAt: String? = null, // Or use a Date type with a TypeAdapter if needed
    val lastReadTimestamp: String? = null // Or use a Date type
)

data class UnreadCountResponse( // Generic response for increment/reset
    val success: Boolean,
    val data: UnreadCountData?,
    val error: String?
)

data class RoomUnreadCountResponse(
    val success: Boolean,
    val count: Int,
    val error: String?
)

data class RoomCount( // For the list of rooms with unread messages
    val roomId: String,
    val count: Int
)
// Request model for updating profile

data class AllUnreadCountsResponse(
    val success: Boolean,
    val data: List<RoomCount>?,
    val totalUnread: Int?,
    val error: String?
)


interface ApiService {

    @POST("login")
    fun login(
        @Body request: LoginRequest
    ): Call<LoginResponse>
    // 1️⃣ Request password reset email
    @POST("reset-password/request")
    suspend fun requestPasswordReset(
        @Body request: ForgotPasswordRequest
    ): Response<Void>

    // 2️⃣ Verify reset token
    @POST("reset-password/verify")
    suspend fun verifyResetToken(
        @Body body: Map<String, String> // { "token": "xyz123" }
    ): Response<Void>

    // 3️⃣ Reset password with token
    @POST("reset-password/confirm/{token}")
    suspend fun resetPassword(
        @Path("token") token: String,
        @Body request: ResetPasswordRequest
    ): Response<ResponseBody>



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

// --- Daily.co endpoints ---

    @POST("dailyco/create-room")
    fun createRoom(@Body request: CreateRoomRequest): Call<CreateRoomResponse>

    @POST("dailyco/generate-token")
    fun generateToken(@Body request: GenerateTokenRequest): Call<GenerateTokenResponse>

    @GET("chatrooms/{roomId}/receiver")
    fun getReceiverInfo(
        @Path("roomId") roomId: String
    ): Call<ReceiverResponse>


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
    ): Call<List<ChatMessage>>

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

    @POST("verify/request-email-code")
    suspend fun requestEmailVerification(@Body emailRequest: EmailRequest): Response<VerificationResponse>

    @POST("verify/confirm-email-code")
    suspend fun confirmEmailVerification(@Body confirmRequest: ConfirmRequest): Response<VerificationResponse>


    @POST("verify/request-phone-code")
    suspend fun requestPhoneVerification(@Body request: PhoneRequest): Response<VerificationResponse>

    @POST("verify/confirm-phone-code")
    suspend fun confirmPhoneVerification(@Body request: ConfirmPhoneRequest): Response<VerificationResponse>

    @POST("unread/increment")
    suspend fun incrementUnreadCount(@Body request: UnreadCountRequest): Response<UnreadCountResponse>

    @POST("unread/reset")
    suspend fun resetUnreadCount(@Body request: UnreadCountRequest): Response<UnreadCountResponse>

    @GET("unread/room")
    suspend fun getUnreadCountForRoom(
        @Query("userId") userId: String,
        @Query("roomId") roomId: String
    ): Response<RoomUnreadCountResponse>
    // NEW: API call to delete a message
    @DELETE("messages/{messageId}")
    suspend fun deleteMessage(
        @Path("messageId") messageId: String,
        @Header("Authorization") authToken: String // Assuming Bearer token authentication
    ): Response<Unit> // Response<Unit> is typical for DELETE if no body is returned

    //post activities calls

    // ✅ Fetch all posts
    @GET("posts")
    fun getAllPosts(): Call<List<Post>>

    @Multipart
    @POST("posts")
    fun createPost(
        @Part("caption") caption: RequestBody,
        @Part("mediaType") mediaType: RequestBody,
        @Part mediaFile: MultipartBody.Part? = null
    ): Call<Post>

    // ✅ Like a post

    // Toggle like — AuthInterceptor in ApiClient will attach Authorization header.

    // ✅ CORRECTED THIS LINE
    @POST("social/like/{postId}")
    fun toggleLike(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<Map<String, Any>>

    @GET("posts/{id}")
    fun getPostById(@Path("id") postId: String): Call<Post>

    @GET("unread/all")
    suspend fun getAllUnreadCountsForUser(
        @Query("userId") userId: String
    ): Response<AllUnreadCountsResponse>
//comments api calls
@GET("social/comments/{postId}")
fun getComments(
    @Header("Authorization") token: String,
    @Path("postId") postId: String
): Call<List<Comment>>

    @POST("social/comment/{postId}")
    fun addComment(
        @Header("Authorization") token: String,
        @Path("postId") postId: String,
        @Body body: Map<String, String>
    ): Call<Comment>

    @POST("social/view/{postId}")
    fun addView(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<Map<String, Any>>

    // ✅ Fetch profile
    @GET("profile")
    suspend fun getProfile(): ProfileResponse

    @GET("social/feed/following")
    fun getFollowingFeed(
        @Header("Authorization") token: String
    ): Call<List<Post>>


    // ✅ Update profile
    @PUT("profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ProfileResponse>

}
