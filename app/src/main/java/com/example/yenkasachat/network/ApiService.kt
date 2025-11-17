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


    // ==================== USERS && USER Profile for AccountInfo====================

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
        @Part("text") text: RequestBody,
        @Part("communityId") communityId: RequestBody,
        @Part("communityName") communityName: RequestBody,
        @Part media: MultipartBody.Part? // optional: imageUrl, videoUrl, or audioUrl
    ): Call<Post>


    @GET("posts/{postId}")
    fun getPostById(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Call<Post>


    @GET("posts/my")
    fun getMyPosts(@Header("Authorization") token: String): Call<List<Post>>


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
    // ==================== COMMENTS ====================
    @POST("comments")
    fun addComment(
        @Header("Authorization") token: String,
        @Body body: RequestBody
    ): Call<Map<String, Any>>

    @PUT("comments/{commentId}")
    fun editComment(
        @Header("Authorization") token: String,
        @Path("commentId") commentId: String,
        @Body body: RequestBody
    ): Call<Map<String, Any>>


    @DELETE("comments/{commentId}")
    fun deleteComment(
        @Header("Authorization") token: String,
        @Path("commentId") commentId: String
    ): Call<Map<String, Any>>

    @POST("comments/toggle-like")
    fun likeComment(
        @Header("Authorization") token: String,
        @Body body: RequestBody
    ): Call<Map<String, Any>>


    // Get replies for a comment
    @GET("comments/{commentId}/replies")
    fun getReplies(
        @Header("Authorization") token: String,
        @Path("commentId") commentId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Call<RepliesResponse>

    //================= Like comment===============//

    @POST("comments/{commentId}/like")
    fun likeComment(
        @Header("Authorization") token: String,
        @Path("commentId") commentId: String
    ): Call<LikeResponse>

    // Unlike comment
    @DELETE("comments/{commentId}/like")
    fun unlikeComment(
        @Header("Authorization") token: String,
        @Path("commentId") commentId: String
    ): Call<LikeResponse>

    @GET("comments/post/{postId}")
    fun getComments(
        @Header("Authorization") token: String,
        @Path("postId") postId: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 50
    ): Call<CommentsResponse>


    // -----------------------------
    // 👍 LIKE / UNLIKE POST (toggle)
    // -----------------------------
    @POST("social/like/{postId}")
    fun toggleLike(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<LikeResponse>


    @GET("posts")
    fun getAllPosts(
        @Header("Authorization") token: String
    ): Call<List<Post>>

    // ✅ Unlike a post
    @DELETE("social/unlike/{postId}")
    fun unlikePost(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<LikeResponse>

    // 🗑️ Delete post
    @DELETE("social/posts/{postId}")
    fun deletePost(
        @Path("postId") postId: String
    ): Call<Map<String, Any>>


    // -----------------------------
    // 👁️‍🗨️ ADD VIEW
    // -----------------------------
    @POST("feed/{postId}/view")
    fun addView(
        @Header("Authorization") token: String,
        @Path("postId") postId: String
    ): Call<ViewResponse>


    // -----------------------------
    // 🤝 FOLLOW / UNFOLLOW USER (toggle)
    // -----------------------------
    @POST("feed/toggle-follow/{targetUserId}")
    fun toggleFollow(
        @Header("Authorization") token: String,
        @Path("targetUserId") targetUserId: String
    ): Call<FollowResponse>

    // -----------------------------
    // 🚫 BLOCK / UNBLOCK USER (toggle)
    // -----------------------------
    @POST("feed/block/{targetUserId}")
    fun blockUser(
        @Header("Authorization") token: String,
        @Path("targetUserId") targetUserId: String
    ): Call<BlockResponse>


    // 🔹 Follow a user
    @POST("follow/{userId}/follow")
    fun followUser(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<FollowResponse>

    @POST("follow/{userId}/unfollow")
    fun unfollowUser(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<FollowResponse>

    // 🔹 Get followers
    @GET("follow/{userId}/followers")
    fun getFollowers(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<List<User>>

    // 🔹 Get following
    @GET("follow/{userId}/following")
    fun getFollowing(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<List<User>>

    // 🔹 Get follower/following counts
    @GET("follow/{userId}/follow-stats")
    fun getFollowStats(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<FollowResponse>




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



    // -----------------------------
    // Other social endpoints can be added here if needed
    // -----------------------------

    // ==================== COMMUNITIES ====================

    // ✅ Get all approved communities (optional search, sort, order)
    @GET("communities")
    fun getCommunities(
        @Header("Authorization") token: String,
        @Query("search") search: String? = null,
        @Query("sort") sort: String? = "memberCount",
        @Query("order") order: String? = "desc"
    ): Call<List<Community>>



    // ✅ Join a community
    @POST("communities/{communityId}/join")
    fun joinCommunity(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<JoinCommunityResponse>



    // ✅ Create a new community
    @POST("communities")
    fun createCommunity(
        @Header("Authorization") token: String,
        @Body request: CreateCommunityRequest
    ): Call<CreateCommunityResponse>

    // ✅ Get the communities created by the logged-in user
    @GET("/communities/user/my-communities")
    fun getMyCommunities(
        @Header("Authorization") token: String
    ): Call<List<Community>>

    @GET("communities")
    fun getCommunities(
        @Header("Authorization") token: String
    ): Call<List<Community>>

    // ✅ Add leave community endpoint
    @POST("communities/{communityId}/leave")
    fun leaveCommunity(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<JoinCommunityResponse>

    // In your ApiService interface, add this method
    @GET("communities/user/joined-communities")
    fun getJoinedCommunities(
        @Header("Authorization") token: String
    ): Call<JoinedCommunitiesResponse>

    @POST("communities/join")
    suspend fun joinCommunities(@Body request: JoinCommunityRequest): Response<JoinCommunityResponse>


    // ==================== COINS ====================

    @POST("coin-transactions/transfer")
    fun transferCoins(
        @Header("Authorization") token: String,
        @Body request: TransferCoinsRequest
    ): Call<TransferCoinsResponse>

    @GET("coin-transactions/balance")
    fun getCoinBalance(
        @Header("Authorization") token: String
    ): Call<CoinBalanceResponse>

    // 📜 Get transaction history
    @GET("coin-transactions/history")
    fun getCoinTransactionHistory(
        @Header("Authorization") token: String
    ): Call<CoinTransactionResponse>

    @GET("coin-transactions/wallet/{walletId}/username")
    fun getUsernameByWalletId(
        @Header("Authorization") token: String,
        @Path("walletId") walletId: String
    ): Call<User>


// ===========================
    // 🏡 FEED ENDPOINTS
    // ===========================


    // ✅ Fetch community feed
    @GET("feed")
    fun getFeed(
        @Header("Authorization") token: String,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Call<FeedResponse>


//=================ViewCOUNT=================//

    @POST("views/{postId}/view")
    suspend fun recordView(
        @Path("postId") postId: String,
        @Header("Authorization") token: String,
        @Body viewData: Map<String, Any> // send { "watchDuration": seconds }
    ): Response<ViewResponse>


    @GET("views/{postId}/views")
    suspend fun getTotalViews(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Response<ViewResponse>

    // ==================== APP VERIFICATION ====================

    @GET("/api/app-verification/dashboard")
    fun getVerificationDashboard(@Header("Authorization") token: String): Call<VerificationDashboard>

    @POST("/api/app-verification/track-login")
    fun trackLogin(@Header("Authorization") token: String): Call<TrackLoginResponse>

    @POST("/api/app-verification/track-ad-view")
    fun trackAdView(@Header("Authorization") token: String): Call<TrackAdViewResponse>

    @GET("/api/app-verification/progress")
    fun getVerificationProgress(@Header("Authorization") token: String): Call<VerificationProgressResponse>

    @POST("/api/app-verification/check-phase-advancement")
    fun checkPhaseAdvancement(@Header("Authorization") token: String): Call<PhaseAdvancementResponse>
}