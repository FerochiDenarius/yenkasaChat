package com.example.yenkasachat.network

import com.example.yenkasachat.model.ChatMessage
import com.example.yenkasachat.model.ChatRoom
import com.example.yenkasachat.model.Contact
import com.example.yenkasachat.model.CreateChatRoomResponse
import com.example.yenkasachat.model.User
import okhttp3.MultipartBody
import retrofit2.Call
import retrofit2.http.*

interface ApiService {

    // ✅ Create a chat room using a recipient username
    @POST("/api/chatrooms")
    fun createChatRoom(
        @Header("Authorization") token: String,
        @Body body: Map<String, String> // Must contain: "username"
    ): Call<CreateChatRoomResponse>

    // ✅ Send a message (text or image)
    @POST("/api/messages")
    fun sendMessage(
        @Header("Authorization") token: String,
        @Body body: Map<String, String> // ✅ Fixed: No wildcards
    ): Call<ChatMessage>

    // ✅ Fetch messages for a specific room
    @GET("/api/messages/{roomId}/messages")
    fun getMessages(
        @Header("Authorization") token: String,
        @Path("roomId") roomId: String
    ): Call<List<ChatMessage>>



    // ✅ Get chat rooms for the logged-in user
    @GET("/api/chatrooms")
    fun getChatRooms(
        @Header("Authorization") token: String
    ): Call<List<ChatRoom>>

    // ✅ Get all users
    @GET("/api/users")
    fun getAllUsers(
        @Header("Authorization") token: String
    ): Call<List<User>>

    // ✅ Add a new contact using username
    @POST("/api/contacts")
    fun addContact(
        @Header("Authorization") token: String,
        @Body body: Map<String, String>
    ): Call<Contact>

    // ✅ Email verification request
    @POST("/api/verify/request")
    fun requestEmailVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    // ✅ Phone verification request
    @POST("/api/verify/request-phone")
    fun requestPhoneVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    // ✅ Confirm verification
    @POST("/api/verify/confirm")
    fun confirmVerification(
        @Body body: Map<String, String>
    ): Call<Map<String, Any>>

    // ✅ Get user’s saved contacts
    @GET("/api/contacts")
    fun getContacts(
        @Header("Authorization") token: String
    ): Call<List<Contact>>

    // ✅ Delete a contact by ID
    @DELETE("/api/contacts/{contactId}")
    fun deleteContact(
        @Header("Authorization") token: String,
        @Path("contactId") contactId: String
    ): Call<Void>

    // ✅ Upload profile picture
    @Multipart
    @POST("/api/users/profile-picture")
    fun uploadProfilePicture(
        @Header("Authorization") token: String,
        @Part image: MultipartBody.Part
    ): Call<Map<String, Any>>

    // ✅ Get user profile
    @GET("/api/users/me")
    fun getUserProfile(
        @Header("Authorization") token: String
    ): Call<User>
}
