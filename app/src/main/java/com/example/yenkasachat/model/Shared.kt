package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

/**
 * Contains basic data models shared across multiple features (Posts, Coins, etc.).
 */

// === Basic user info ===
data class UserBasic(
    @SerializedName("_id")
    val id: String,
    val username: String,
    val profileImage: String? = null,
    val verified: Boolean = false
)

// === Basic community info ===
data class CommunityBasic(
    @SerializedName("_id")
    val id: String,
    val name: String,
    val displayName: String
)

// === Pagination ===
data class PaginationInfo(
    val currentPage: Int,
    val totalPages: Int,
    val pageSize: Int,
    val totalItems: Int
)
