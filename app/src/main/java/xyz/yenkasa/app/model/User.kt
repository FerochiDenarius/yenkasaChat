package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

data class User(

    @SerializedName("_id")
    val _id: String,

    @SerializedName("username")
    val username: String,

    @SerializedName("email")
    val email: String? = null,

    @SerializedName("phoneNumber")
    val phone: String? = null,

    @SerializedName("location")
    val location: String? = null,

    @SerializedName("gender")
    val gender: String? = null,

    @SerializedName("dateOfBirth")
    val dateOfBirth: String? = null,

    @SerializedName("verified")
    val verified: Boolean = false,

    @SerializedName("profileImage")
    val profileImage: String? = null,

    @SerializedName("coinsBalance")
    val coinsBalance: Double = 0.0,

    @SerializedName("coinsBalancePrecise")
    val coinsBalancePrecise: Double? = null,

    @SerializedName("ykcBalance")
    val ykcBalance: Double? = null,

    @SerializedName("community")
    val community: Community? = null,

    @SerializedName("walletId")
    val walletId: String? = null,

    @SerializedName("createdAt")
    val createdAt: String? = null,

    @SerializedName("updatedAt")
    val updatedAt: String? = null,

    @SerializedName("suspendedUntil")
    val suspendedUntil: String? = null,

    @SerializedName("role")
    val role: Role? = null,

    @SerializedName("roleName")
    val roleName: String? = null,

    @SerializedName("followers")
    val followers: List<String>? = emptyList(),

    @SerializedName("following")
    val following: List<String>? = emptyList()
) {
    fun resolvedCoinsBalance(): Double = coinsBalancePrecise ?: ykcBalance ?: coinsBalance
}
