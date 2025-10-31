package com.example.yenkasachat.network

import com.example.yenkasachat.model.*
import com.example.yenkasachat.network.model.ToggleLikeResponse
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.*
import com.example.yenkasachat.model.FeedResponse
import com.example.yenkasachat.model.LikeResponse
import com.example.yenkasachat.model.UnreadCountRequest
import com.example.yenkasachat.model.RoomUnreadCountResponse








// ===========================================================
// 🌐 API INTERFACE
// ===========================================================

interface ApiService {

    // ==================== AUTH ====================

    @POST("login")
    fun login(@Body request: LoginRequest): Call<LoginResponse>

    @POST("reset-password/request")
    suspend fun requestPasswordReset(@Body request: ForgotPasswordRequest): Response<Void>

    @POST("reset-password/verify")
    suspend fun verifyResetToken(@Body body: Map<String, String>): Response<Void>

    @POST("reset-password/confirm/{token}")
    suspend fun resetPassword(
        @Path("token") token: String,
        @Body request: ResetPasswordRequest
    ): Response<ResponseBody>


    // ==================== USERS ====================

    @GET("users")
    fun getAllUsers(): Call<List<User>>

    @Multipart
    @POST("users/profile-picture")
    fun uploadProfilePicture(@Part image: MultipartBody.Part): Call<Map<String, Any>>

    @GET("users/me")
    fun getUserProfile(): Call<User>

    @PATCH("users/{userId}/player-id")
    fun updatePlayerId(
        @Path("userId") userId: String,
        @Body body: Map<String, String>
    ): Call<ResponseBody>

    @PATCH("users/{userId}/fcm-token")
    fun updateFcmToken(@Path("userId") userId: String, @Body body: Map<String, String>): Call<Void>


    // ==================== CHATROOMS ====================

    @POST("chatrooms")
    fun createChatRoom(@Body request: CreateChatRoomRequest): Call<CreateChatRoomResponse>

    @GET("chatrooms")
    fun getChatRooms(): Call<List<ChatRoom>>

    @GET("chatrooms/user/{userId}")
    fun getUserChatRooms(@Path("userId") userId: String): Call<List<ChatRoom>>


    // ==================== DAILY.CO VIDEO ====================

    @POST("dailyco/create-room")
    fun createRoom(@Body request: CreateRoomRequest): Call<CreateRoomResponse>

    @POST("dailyco/generate-token")
    fun generateToken(@Body request: GenerateTokenRequest): Call<GenerateTokenResponse>


    // ==================== CHAT RECEIVER ====================

    @GET("chatrooms/{roomId}/receiver")
    fun getReceiverInfo(@Path("roomId") roomId: String): Call<ReceiverResponse>

    @POST("chatroom/{receiverId}")
    fun getOrCreateChatRoom(@Path("receiverId") receiverId: String): Call<CreateChatRoomResponse>


    // ==================== MESSAGES ====================

    @POST("messages")
    fun sendMessage(@Body body: Map<String, @JvmSuppressWildcards Any?>): Call<ChatMessage>

    @GET("messages/{roomId}")
    fun getMessages(@Path("roomId") roomId: String): Call<List<ChatMessage>>

    @DELETE("messages/{messageId}")
    suspend fun deleteMessage(
        @Path("messageId") messageId: String,
        @Header("Authorization") authToken: String
    ): Response<Unit>


    // ==================== CONTACTS ====================

    @POST("contacts")
    fun addContact(@Body body: Map<String, String>): Call<Contact>

    @GET("contacts")
    fun getContacts(): Call<List<Contact>>

    @DELETE("contacts/{contactId}")
    fun deleteContact(@Path("contactId") contactId: String): Call<Void>


    // ==================== NOTIFICATIONS ====================

    @POST("notify")
    fun sendPushNotification(@Body request: PushNotificationRequest): Call<Void>


    // ==================== VERIFICATION ====================

    @POST("verify/request-email-code")
    suspend fun requestEmailVerification(@Body emailRequest: EmailRequest): Response<VerificationResponse>

    @POST("verify/confirm-email-code")
    suspend fun confirmEmailVerification(@Body confirmRequest: ConfirmRequest): Response<VerificationResponse>

    @POST("verify/request-phone-code")
    suspend fun requestPhoneVerification(@Body request: PhoneRequest): Response<VerificationResponse>

    @POST("verify/confirm-phone-code")
    suspend fun confirmPhoneVerification(@Body request: ConfirmPhoneRequest): Response<VerificationResponse>


    // ==================== UNREAD COUNTS ====================

    @POST("unread/increment")
    suspend fun incrementUnreadCount(@Body request: UnreadCountRequest): Response<UnreadCountResponse>

    @POST("unread/reset")
    suspend fun resetUnreadCount(@Body request: UnreadCountRequest): Response<UnreadCountResponse>

    @GET("unread/room")
    suspend fun getUnreadCountForRoom(
        @Query("userId") userId: String,
        @Query("roomId") roomId: String
    ): Response<RoomUnreadCountResponse>

    @GET("unread/all")
    suspend fun getAllUnreadCountsForUser(
        @Query("userId") userId: String
    ): Response<AllUnreadCountsResponse>


    // ==================== POSTS ====================

    @GET("posts")
    fun getAllPosts(): Call<List<Post>>

    @Multipart
    @POST("posts")
    fun createPost(
        @Part("caption") caption: RequestBody,
        @Part("mediaType") mediaType: RequestBody,
        @Part mediaFile: MultipartBody.Part? = null
    ): Call<Post>

    @POST("social/like/{postId}")
    fun toggleLike(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<Map<String, Any>>

    @GET("posts/{postId}")
    fun getPostById(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Call<Post>



    @GET("posts/my")
    fun getMyPosts(@Header("Authorization") token: String): Call<List<Post>>

    @GET("feed/following")
    fun getFollowingFeed(@Header("Authorization") token: String): Call<List<Post>>

    @DELETE("posts/{postId}")
    fun deletePost(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<Map<String, Any>>

    @POST("posts/approve/{id}")
    fun approvePost(@Path("id") postId: String): Call<Post>

    @POST("posts/reject/{id}")
    fun rejectPost(@Path("id") postId: String): Call<Post>

    @GET("posts/pending")
    fun getPendingPosts(): Call<List<Post>>

    @PATCH("posts/{postId}/status")
    fun updatePostStatus(
        @Path("postId") postId: String,
        @Query("approved") approved: Boolean
    ): Call<Void>


    // ==================== COMMENTS ====================

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


    // ==================== PROFILE ====================

    @GET
    fun getProfileDynamic(
        @Url url: String,
        @Header("Authorization") token: String
    ): Call<ProfileResponse>

    @GET("profile")
    suspend fun getProfile(): ProfileResponse

    @PUT("profile")
    suspend fun updateProfile(@Body request: UpdateProfileRequest): Response<ProfileResponse>


    // ==================== FOLLOW SYSTEM ====================

    @POST("users/toggle-follow/{userId}")
    fun toggleFollow(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<Map<String, Any>>

    @GET("users/{userId}/followers")
    fun getFollowers(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<List<User>>

    @GET("users/{userId}/following")
    fun getFollowing(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<List<User>>

    @POST("/users/{id}/follow")
    fun followUser(
        @Header("Authorization") token: String,
        @Path("id") userId: String
    ): Call<Map<String, Any>>

    @POST("/users/{id}/unfollow")
    fun unfollowUser(
        @Header("Authorization") token: String,
        @Path("id") userId: String
    ): Call<Map<String, Any>>

    @POST("users/{id}/block")
    fun blockUser(
        @Header("Authorization") token: String,
        @Path("id") userId: String
    ): Call<Map<String, Any>>

    @POST("users/{id}/unblock")
    fun unblockUser(
        @Header("Authorization") token: String,
        @Path("id") userId: String
    ): Call<Map<String, Any>>


    // ==================== COMMUNITIES ====================

    @GET("/api/communities")
    fun getCommunities(
        @Query("search") search: String? = null,
        @Query("sort") sort: String? = null,
        @Query("order") order: String? = null
    ): Call<List<Community>>

    @GET("/api/communities/{communityId}")
    fun getCommunityDetails(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<Community>

    @POST("/api/communities/{communityId}/join")
    fun joinCommunity(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<JoinCommunityResponse>

    @POST("/api/communities/{communityId}/leave")
    fun leaveCommunity(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<JoinCommunityResponse>

    @POST("/api/communities")
    fun createCommunity(
        @Header("Authorization") token: String,
        @Body request: CreateCommunityRequest
    ): Call<CreateCommunityResponse>

    @GET("/api/communities/user/my-communities")
    fun getMyCommunities(@Header("Authorization") token: String): Call<Map<String, Any>>


    // ==================== COINS ====================

    @GET("coins/balance")
    fun getCoinBalance(
        @Header("Authorization") token: String
    ): Call<CoinBalanceResponse>

    @POST("/api/coins/transfer")
    fun transferCoins(
        @Header("Authorization") token: String,
        @Body request: TransferCoinsRequest
    ): Call<TransferCoinsResponse>

    @GET("/api/coins/transactions")
    fun getTransactions(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50,
        @Query("type") type: String? = null
    ): Call<TransactionsResponse>


    @GET("coins/history")
    fun getCoinHistory(
        @Header("Authorization") token: String
    ): Call<CoinTransactionResponse>

// ===========================
    // 🏡 FEED ENDPOINTS
    // ===========================

    // ✅ Fetch community feed
    @GET("feed")
    fun getFeed(
        @Header("Authorization") token: String,
        @Query("page") page: Int,
        @Query("limit") limit: Int
    ): Call<FeedResponse>

    // ✅ Like a post
    @POST("feed/{postId}/like")
    fun likePost(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<LikeResponse>

    // ✅ Unlike a post
    @DELETE("feed/{postId}/like")
    fun unlikePost(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<LikeResponse>

    // ==================== APP VERIFICATION ====================

    @GET("/api/appverification/dashboard")
    fun getVerificationDashboard(
        @Header("Authorization") token: String
    ): Call<VerificationDashboard>

    @POST("/api/appverification/track-login")
    fun trackLogin(
        @Header("Authorization") token: String
    ): Call<TrackLoginResponse>

    @POST("/api/appverification/track-ad-view")
    fun trackAdView(
        @Header("Authorization") token: String
    ): Call<TrackAdViewResponse>

    @GET("/api/appverification/progress")
    fun getVerificationProgress(
        @Header("Authorization") token: String
    ): Call<VerificationProgressResponse>

    @POST("/api/appverification/check-phase-advancement")
    fun checkPhaseAdvancement(
        @Header("Authorization") token: String
    ): Call<PhaseAdvancementResponse>
}