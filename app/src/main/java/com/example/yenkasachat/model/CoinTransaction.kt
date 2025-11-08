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
    val pagination: PaginationInfo // refers to the shared pagination model
)

data class CoinTransaction(
    @SerializedName("_id")
    val transactionId: String,

    val fromUserId: UserBasic? = null, // populated from backend
    val toUserId: UserBasic? = null,   // populated from backend

    val amount: Int,
    val type: String, // REWARD_POST, REWARD_FOLLOW, REWARD_LIKE, REWARD_COMMENT, TRANSFER, etc.
    val description: String,

    val relatedPostId: PostBasic? = null,
    val relatedCommentId: String? = null,

    // 🧾 Snapshot fields (immutable, stored in backend)
    val senderUsername: String? = null,
    val senderWalletId: String? = null,
    val recipientUsername: String? = null,
    val recipientWalletId: String? = null,

    val status: String = "completed",
    val createdAt: String,

    // Client-side computed fields (for UI display)
    var direction: String? = null, // "incoming" or "outgoing"
    var otherParty: UserBasic? = null // other participant in the transaction
)

// === Basic post info for transactions ===
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

// === Transaction info snapshot (for quick responses) ===
data class TransactionInfo(
    val transactionId: String,
    val amount: Int,
    val from: String,
    val to: String,
    val newBalance: Int,

    // include snapshot usernames for context
    val senderUsername: String? = null,
    val recipientUsername: String? = null
)
