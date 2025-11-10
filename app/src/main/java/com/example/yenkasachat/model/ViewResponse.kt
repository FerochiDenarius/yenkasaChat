package com.example.yenkasachat.model


data class ViewResponse(
    val success: Boolean,
    val message: String? = null,
    val viewsCount: Int = 0,
    val view: ViewData? = null // optional: backend may include the saved view
)

data class ViewData(
    val _id: String,
    val postId: String,
    val userId: String,
    val activityId: String,
    val username: String? = null,
    val viewedAt: String
)