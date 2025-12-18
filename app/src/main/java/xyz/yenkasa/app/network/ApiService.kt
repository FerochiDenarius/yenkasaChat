package xyz.yenkasa.app.network

import xyz.yenkasa.app.model.*
import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Call
import retrofit2.Response
import retrofit2.http.*
import xyz.yenkasa.app.model.FeedResponse
import xyz.yenkasa.app.model.LikeResponse
import xyz.yenkasa.app.model.UnreadCountRequest
import xyz.yenkasa.app.model.RoomUnreadCountResponse



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

    @Multipart
    @POST("users/profile-picture")
    fun uploadProfilePicture(
        @Header("Authorization") token: String,
        @Part profileImage: MultipartBody.Part
    ): Call<UploadPictureResponse>



    @PUT("users/profile")
    suspend fun updateProfile(
        @Header("Authorization") token: String,
        @Body request: UpdateProfileRequest
    ): Response<GenericSuccessResponse>


    @GET("users/me")
    fun getUserProfile(
        @Header("Authorization") token: String
    ): Call<User>

    @PUT("users/change-password")
    suspend fun changePassword(
        @Header("Authorization") token: String,
        @Body body: ChangePasswordRequest
    ): Response<GenericSuccessResponse>


    @PUT("/api/users/password")
    suspend fun updatePassword(
        @Header("Authorization") token: String,
        @Body request: UpdatePasswordRequest
    ): Response<GenericSuccessResponse>


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

    @POST("email-verification/request")
    suspend fun requestEmailVerification(
        @Body emailRequest: EmailRequest
    ): Response<VerificationResponse>

    @FormUrlEncoded
    @POST("email-verification/confirm")
    suspend fun confirmEmailVerification(
        @Field("code") code: String
    ): Response<VerificationResponse>

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

    @GET("posts/by-communities")
    fun getPostsByCommunities(
        @Header("Authorization") token: String,
        @Query("names") communityNames: String,   // 👈 VARIABLE NAME!!!
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Call<FeedResponse>


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



    // =====================
// POST APPROVAL ENDPOINTS
// =====================

    @GET("post-approval/pending")
    fun getPendingApprovalPosts(
        @Header("Authorization") token: String
    ): Call<PostApprovalResponse>

    @PUT("post-approval/{id}/approve")
    fun approvePendingPost(
        @Path("id") approvalId: String,
        @Header("Authorization") token: String
    ): Call<Void>

    @PUT("post-approval/{id}/reject")
    fun rejectPendingPost(
        @Path("id") approvalId: String,
        @Header("Authorization") token: String
    ): Call<Void>

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


    //================= Like comment===============//


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


    // ==================== COMMUNITIES ====================

    // ✅ Get all approved communities (optional search, sort, order)
    @GET("communities")
    fun getCommunities(
        @Header("Authorization") token: String,
        @Query("search") search: String? = null,
        @Query("sort") sort: String? = "memberCount",
        @Query("order") order: String? = "desc"
    ): Call<List<Community>>

    @GET("communities/public")
    fun getPublicCommunities(): Call<List<Community>>



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

    @GET("user/all-communities")
    fun getAllUserCommunities(@Header("Authorization") token: String): Call<JoinedCommunitiesResponse>



    @POST("communities/{communityId}/join")
    fun joinCommunity(
        @Header("Authorization") token: String,
        @Path("communityId") communityId: String
    ): Call<JoinCommunityResponse>

    @GET("/api/communities/user/community")
    fun getUserPrimaryCommunity(
        @Header("Authorization") token: String
    ): Call<UserPrimaryCommunityResponse>




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
        @Body viewData: ViewRequest
    ): Response<ViewResponse>


    @GET("views/{postId}/views")
    suspend fun getTotalViews(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Response<ViewResponse>

    //verifications calls

    @GET("app-verification/dashboard")
    fun getDashboard(
        @Header("Authorization") token: String
    ): Call<VerificationDashboard>

    @POST("app-verification/track-login")
    fun trackLogin(
        @Header("Authorization") token: String
    ): Call<TrackLoginResponse>

    @POST("app-verification/track-ad-view")
    fun trackAdView(
        @Header("Authorization") token: String
    ): Call<TrackAdViewResponse>



    @GET("app-verification/progress")
    fun getProgress(
        @Header("Authorization") token: String
    ): Call<VerificationProgressResponse>

    @POST("app-verification/check-phase-advancement")
    fun checkPhaseAdvancement(@Header("Authorization") auth: String): Call<PhaseAdvancementResponse>

    // GET /api/metrics/:userId/performance-metrics
    @GET("metrics/{userId}/performance-metrics")
    fun getPerformanceMetrics(
        @Path("userId") userId: String,
        @Header("Authorization") token: String
    ): Call<UserPerformanceMetricsResponse>


    // ───────────────────────────────
// USER PRIVACY
// ───────────────────────────────

    @GET("user-privacy/get")
    fun getPrivacy(): Call<UserPrivacyModel>

    @PUT("user-privacy/set-privacy")
    fun setPrivacy(
        @Query("privacyLevel") level: String
    ): Call<ApiResponse>


// ───────────────────────────────
// USER BLOCK SYSTEM
// ───────────────────────────────

    @POST("user-privacy/block")
    fun blockUser(
        @Body request: BlockUserRequest
    ): Call<ApiResponse>


    @POST("user-privacy/unblock")
    fun unblockUser(
        @Body request: UnblockUserRequest
    ): Call<ApiResponse>



    @GET("user-privacy/blocked-users")
    fun getBlockedUsers(
        @Header("Authorization") token: String
    ): Call<List<BlockedUserModel>>


    @GET("user-privacy/who-blocked-you")
    fun getWhoBlockedYou(): Call<List<BlockedUserModel>>

    @GET("user-privacy/is-blocked")
    fun isBlocked(
        @Query("targetId") targetId: String
    ): Call<ApiResponse>

// ───────────────────────────────
// POST VISIBILITY (COMMUNITY + USERS)
// ───────────────────────────────

    @GET("user-privacy/community-visibility")
    fun getCommunityVisibility(
        @Header("Authorization") token: String
    ): Call<List<CommunityVisibilityModel>>


    @POST("community-visibility")
    fun saveCommunityVisibility(
        @Header("Authorization") token: String,
        @Body visibilityList: List<CommunityVisibilityModel>
    ): Call<ApiResponse>


    @POST("user-privacy/block-community")
    fun blockCommunity(
        @Body request: BlockCommunityRequest
    ): Call<ApiResponse>

    @POST("user-privacy/unblock-community")
    fun unblockCommunity(
        @Body request: BlockCommunityRequest
    ): Call<ApiResponse>

    @GET("user-privacy/hidden-users")
    fun getHiddenUsers(): Call<List<BlockedUserModel>>

    @POST("user-privacy/hide-user")
    fun hideUserFromPosts(
        @Body request: BlockUserFromPostsRequest
    ): Call<ApiResponse>

    @POST("user-privacy/unhide-user")
    fun unhideUserFromPosts(
        @Body request: BlockUserFromPostsRequest
    ): Call<ApiResponse>

// ───────────────────────────────
// MESSAGE REQUESTS
// ───────────────────────────────

    @POST("user-privacy/message-request")
    fun sendMessageRequest(
        @Body request: MessageRequest
    ): Call<ApiResponse>

    @POST("user-privacy/approve-request")
    fun approveMessageRequest(
        @Query("requestId") requestId: String
    ): Call<ApiResponse>


// ───────────────────────────────
// NOTIFICATIONS
// ───────────────────────────────

    @GET("notifications/all")
    fun getNotifications(): Call<List<NotificationModel>>

    @PUT("notifications/{id}/read")
    fun markNotificationRead(
        @Path("id") id: String,
        @Header("Authorization") auth: String
    ): Call<ApiResponse>




    @DELETE("posts/{postId}")
    fun deletePost(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Call<GenericResponse>

    @POST("posts/{postId}/hide")
    fun hidePost(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Call<GenericResponse>


    @POST("posts/{postId}/flag")
    fun flagPost(
        @Path("postId") postId: String,
        @Header("Authorization") token: String,
        @Body request: FlagRequest
    ): Call<GenericResponse>

    @GET("posts/{postId}/download")
    fun getPostMedia(
        @Path("postId") postId: String,
        @Header("Authorization") token: String
    ): Call<MediaResponse>

//Ads and reward


    @POST("ads/view/{adId}")
    fun recordAdView(
        @Path("adId") adId: String,
        @Header("Authorization") auth: String,
        @Body body: Map<String, @JvmSuppressWildcards Any>
    ): Call<Map<String, Any>>

    @POST("ads/reward/{adId}")
    fun rewardAd(
        @Path("adId") adId: String,
        @Header("Authorization") auth: String,
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    @Multipart
    @POST("ads/create")
    fun createSponsoredAd(
        @Header("Authorization") token: String,
        @Body request: MultipartBody
    ): Call<AdCreateResponse>

    @POST("ads/click/{adId}")
    suspend fun rewardAdClick(
        @Path("adId") adId: String,
        @Header("Authorization") token: String
    ): RewardResponse




}