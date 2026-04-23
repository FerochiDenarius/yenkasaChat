package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName
import org.json.JSONObject

/**
 * Contains basic data models shared across multiple features (Posts, Coins, etc.).
 */

// === Basic user info ===
data class UserBasic(
    @SerializedName("_id")
    val id: String,
    val username: String,
    val profileImage: String? = null,
    val verified: Boolean = false,
    val roleName: String? = null
) {
    companion object {
        fun fromJson(json: JSONObject?): UserBasic {
            if (json == null) return UserBasic("", "Unknown", null, false, null)
            return UserBasic(
                id = json.optString("_id"),
                username = json.optString("username", "Unknown"),
                profileImage = json.optString("profileImage", null),
                verified = json.optBoolean("verified", false),
                roleName = json.optString("roleName", null)
            )
        }
    }
}

// === Basic community info ===
data class CommunityBasic(
    @SerializedName("_id")
    val id: String,
    val name: String,
    val displayName: String
) {
    companion object {
        fun fromJson(json: JSONObject?): CommunityBasic? {
            if (json == null) return null
            return CommunityBasic(
                id = json.optString("_id"),
                name = json.optString("name", "general"),
                displayName = json.optString("displayName", "General")
            )
        }
    }
}

// === Pagination ===
data class PaginationInfo(
    val currentPage: Int,
    val totalPages: Int,
    val pageSize: Int,
    val totalItems: Int
)
