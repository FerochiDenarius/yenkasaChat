package xyz.yenkasa.app.model

data class BlockResponse(
    val message: String,       // "User blocked" or "User unblocked"
    val userId: String,        // the user performing the block/unblock
    val blockedUserId: String  // the target user being blocked/unblocked
)
