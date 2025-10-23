package com.example.yenkasachat.model

data class Post(
    val _id: String? = null,                 // MongoDB ID
    val user: User? = null,                  // The user who created the post
    val caption: String? = null,             // Text part of the post
    val mediaType: String? = null,           // "text", "image", "video", "audio"
    val mediaUrl: String? = null,            // Cloudinary / backend media URL
    val thumbnailUrl: String? = null,        // Optional (for videos)
    val createdAt: String? = null,           // ISO timestamp
    val updatedAt: String? = null,           // ISO timestamp
    val likes: List<String>? = emptyList(),  // List of user IDs who liked
    val commentsCount: Int? = 0,             // Count of comments
    val sharesCount: Int? = 0,
    var viewsCount: Int = 0,
    var isLiked: Boolean = false, // to track if current user liked it
    var isViewed: Boolean = false // Count of shares
)
