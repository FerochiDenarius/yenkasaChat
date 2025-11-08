package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

// NOTE: UserBasic and PaginationInfo have been moved to Shared.kt and will be imported automatically.

// === Coin balance response ===
data class CoinBalanceResponse(
    val success: Boolean,
    val walletId: String?,
    val balance: Int
)


data class CoinBalance(
    val balance: Int,
    val totalEarned: Int,
    val totalSpent: Int,
    val walletId: String,
    val username: String
)

// === Coin transactions ===
data class CoinTransactionResponse(
    val success: Boolean,
    val transactions: List<CoinTransaction>
)

data class TransactionsResponse(
    val transactions: List<CoinTransaction>,
    val pagination: PaginationInfo // This now refers to the class in Shared.kt
)

data class CoinTransaction(
    @SerializedName("_id")
    val transactionId: String,

    val fromUserId: UserBasic? = null, // This now refers to the class in Shared.kt
    val toUserId: UserBasic? = null,   // This now refers to the class in Shared.kt

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

// === Basic post info for transactions ===
data class PostBasic(
    val text: String,
    val imageUrl: String? = null
)

// === Transfer coins request & response ===
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
