package xyz.yenkasa.app.model

import com.google.gson.annotations.SerializedName

// === Coin balance response ===
data class CoinBalanceResponse(
    val success: Boolean,
    val walletId: String?,
    val balance: Double
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

// === Individual coin transaction ===
// === Individual coin transaction ===
data class CoinTransaction(
    @SerializedName(value = "_id", alternate = ["transactionId"])
    val transactionId: String,

    val fromUserId: String? = null,
    val toUserId: String? = null,

    val amount: Int,
    val type: String, // e.g. REWARD_POST, REWARD_FOLLOW, TRANSFER, etc.
    val description: String,

    val relatedPostId: String? = null,
    val relatedCommentId: String? = null,

    // Backend fields
    @SerializedName("fromUsername") val fromUsername: String? = null,
    @SerializedName("fromWalletId") val fromWalletId: String? = null,
    @SerializedName("toUsername") val toUsername: String? = null,
    @SerializedName("toWalletId") val toWalletId: String? = null,

    val status: String = "completed",
    val createdAt: String,

    val activityId: String? = null, // <-- NEW field

    // UI helper fields
    var direction: String? = null, // "incoming" or "outgoing"
    var otherParty: UserBasic? = null
)

// === UI model for RecyclerView ===
data class TransactionUiModel(
    val transactionId: String,
    val amount: Int,
    val from: String,          // fromWalletId
    val to: String,            // toWalletId
    val newBalance: Int,       // toUserBalanceAfter
    val senderUsername: String?,
    val recipientUsername: String?,
    val description: String = "",
    val type: String = "",
    val createdAt: String = "",
    val activityId: String? = null // <-- NEW field
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
    val message: String?,
    val activityId: String? = null,
    val clientTransactionId: String? = null,
    val idempotencyKey: String? = null
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
    @SerializedName(value = "transactionId", alternate = ["_id"]) val transactionId: String,
    @SerializedName("amount") val amount: Int,
    @SerializedName("fromWalletId") val fromWalletId: String,
    @SerializedName("toWalletId") val toWalletId: String,
    @SerializedName("fromUsername") val fromUsername: String?,
    @SerializedName("toUsername") val toUsername: String?,
    @SerializedName("fromUserBalanceAfter") val fromUserBalanceAfter: Int?,
    @SerializedName("toUserBalanceAfter") val toUserBalanceAfter: Int?,
    @SerializedName("activityId") val activityId: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("status") val status: String? = null
)

// === UI model for RecyclerView ===
// === Individual coin transaction ===
