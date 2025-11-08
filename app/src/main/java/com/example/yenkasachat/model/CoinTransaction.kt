package com.example.yenkasachat.model

import com.google.gson.annotations.SerializedName

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
    val pagination: PaginationInfo // from shared model file
)

data class CoinTransaction(
    @SerializedName("_id")
    val transactionId: String,

    val fromUserId: UserBasic? = null, // uses existing UserBasic
    val toUserId: UserBasic? = null,   // uses existing UserBasic

    val amount: Int,
    val type: String, // e.g. REWARD_POST, REWARD_FOLLOW, etc.
    val description: String,

    val relatedPostId: PostBasic? = null,
    val relatedCommentId: String? = null,

    // 🧾 Snapshot fields
    val senderUsername: String? = null,
    val senderWalletId: String? = null,
    val recipientUsername: String? = null,
    val recipientWalletId: String? = null,

    val status: String = "completed",
    val createdAt: String,

    // UI-only fields
    var direction: String? = null, // "incoming" or "outgoing"
    var otherParty: UserBasic? = null // other participant
)

// === Basic post info ===
data class PostBasic(
    val text: String,
    val imageUrl: String? = null
)

// === Transfer coins request & response ===
data class TransferCoinsRequest(
    val toWalletId: String,
    val recipientUsername: String?,
    val amount: Int,
    val message: String?
)

data class TransferCoinsResponse(
    val success: Boolean,
    val message: String,
    val transaction: TransactionInfo? = null,
    val error: String? = null,
    val balance: Int? = null,
    val required: Int? = null
)

// === Transaction info snapshot ===
data class TransactionInfo(
    @SerializedName("_id")
    val transactionId: String,
    val amount: Int,
    val from: String,
    val to: String,
    val newBalance: Int,
    val senderUsername: String? = null,
    val recipientUsername: String? = null
)
