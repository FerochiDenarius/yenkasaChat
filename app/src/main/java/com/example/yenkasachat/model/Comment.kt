package com.example.yenkasachat.model



    data class Comment(
        val _id: String,
        val postId: String,
        val user: CommentUser?,
        val text: String,
        val createdAt: String
    )

    data class CommentUser(
        val _id: String,
        val username: String,
        val profileImage: String?
    )

