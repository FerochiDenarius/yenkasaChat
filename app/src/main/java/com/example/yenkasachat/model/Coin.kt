// app/src/main/java/com/example/yenkasachat/model/Coin.kt
package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

data class CoinBalance(
    val balance: Int,
    val totalEarned: Int,
    val totalSpent: Int,
    val walletId: String,
    val username: String
)

data class CoinTransaction(
    @SerializedName("_id")
    val transactionId: String,

    val fromUserId: UserBasic? = null,
    val toUserId: UserBasic,

    val amount: Int,
    val type: String, // REWARD_POST, REWARD_FOLLOW, REWARD_LIKE, REWARD_COMMENT, TRANSFER
    val description: String,

    val relatedPostId: PostBasic? = null,
    val relatedCommentId: String? = null,

    val status: String = "completed",

    val createdAt: String,

    // Client-side computed
    var direction: String? = null, // "incoming" or "outgoing"
    var otherParty: UserBasic? = null
)

data class PostBasic(
    val text: String,
    val imageUrl: String? = null
)

data class TransferCoinsRequest(
    val toUsername: String,
    val amount: Int,
    val message: String? = null
)

data class TransferCoinsResponse(
    val success: Boolean,
    val message: String,
    val transaction: TransactionInfo? = null,
    val error: String? = null,
    val balance: Int? = null,
    val required: Int? = null
)

data class TransactionInfo(
    val transactionId: String,
    val amount: Int,
    val from: String,
    val to: String,
    val newBalance: Int
)

data class TransactionsResponse(
    val transactions: List<CoinTransaction>,
    val pagination: PaginationInfo
)