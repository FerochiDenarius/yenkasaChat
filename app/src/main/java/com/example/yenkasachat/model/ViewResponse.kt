package com.example.yenkasachat.model

data class ViewResponse(
    val success: Boolean,
    val message: String,
    val viewsCount: Int,
    val postId: String? = null
)
