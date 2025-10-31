package com.example.yenkasachat.model

data class Permissions(
    val canPost: Boolean = false,
    val canComment: Boolean = false,
    val canCreateCommunity: Boolean = false
)

