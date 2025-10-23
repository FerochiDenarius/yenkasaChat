package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class Post(
    @SerializedName("_id")
    val _id: String? = null,                 // MongoDB ID

    @SerializedName("user")
    val user: User? = null,                  // The user who created the post

    @SerializedName("caption")
    val caption: String? = null,             // Text part of the post

    @SerializedName("mediaType")
    val mediaType: String? = null,           // "text", "image", "video", "audio"

    @SerializedName("mediaUrl")
    val mediaUrl: String? = null,            // Cloudinary / backend media URL

    @SerializedName("thumbnailUrl")
    val thumbnailUrl: String? = null,        // Optional (for videos)

    @SerializedName("createdAt")
    val createdAt: String? = null,           // ISO timestamp

    @SerializedName("updatedAt")
    val updatedAt: String? = null,           // ISO timestamp

    @SerializedName("likes")
    var likes: List<String> = emptyList(),   // List of user IDs who liked (non-null)

    @SerializedName("likesCount")
    var likesCount: Int = 0,                 // explicit count for quick access

    @SerializedName("likedByUser")
    var likedByUser: Boolean = false,        // whether the current user has liked this post

    @SerializedName("commentsCount")
    var commentsCount: Int = 0,              // Count of comments

    @SerializedName("sharesCount")
    var sharesCount: Int = 0,

    @SerializedName("viewsCount")
    var viewsCount: Int = 0,

    @SerializedName("isViewed")
    var isViewed: Boolean = false            // whether current user has viewed
)