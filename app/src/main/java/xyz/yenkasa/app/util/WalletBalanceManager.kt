package xyz.yenkasa.app.util

import android.content.Context
import android.content.Intent
import android.util.Log
import xyz.yenkasa.app.model.CoinBalanceResponse
import xyz.yenkasa.app.network.ApiClient
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

object WalletBalanceManager {
    const val ACTION_BALANCE_UPDATED = "xyz.yenkasa.app.WALLET_BALANCE_UPDATED"
    const val EXTRA_BALANCE = "extra_balance"
    const val EXTRA_BALANCE_DOUBLE = "extra_balance_double"
    const val EXTRA_WALLET_ID = "extra_wallet_id"
    const val EXTRA_REWARD_AMOUNT = "extra_reward_amount"
    const val EXTRA_REWARD_AMOUNT_DOUBLE = "extra_reward_amount_double"

    private const val TAG = "WalletBalanceManager"

    fun applyKnownBalance(
        context: Context,
        balance: Double,
        walletId: String? = null,
        rewardAmount: Double? = null
    ) {
        val appContext = context.applicationContext
        val previousBalance = TokenManager.getCoinsPrecise(appContext)
        TokenManager.saveCoinsPrecise(appContext, balance)

        if (previousBalance == balance) return

        appContext.sendBroadcast(
            Intent(ACTION_BALANCE_UPDATED)
                .setPackage(appContext.packageName)
                .putExtra(EXTRA_BALANCE, balance.toInt())
                .putExtra(EXTRA_BALANCE_DOUBLE, balance)
                .putExtra(EXTRA_WALLET_ID, walletId)
                .putExtra(EXTRA_REWARD_AMOUNT, (rewardAmount ?: 0.0).toInt())
                .putExtra(EXTRA_REWARD_AMOUNT_DOUBLE, rewardAmount ?: 0.0)
        )
    }

    fun applyKnownBalance(
        context: Context,
        balance: Int,
        walletId: String? = null,
        rewardAmount: Int? = null
    ) = applyKnownBalance(context, balance.toDouble(), walletId, rewardAmount?.toDouble())

    fun refreshBalance(context: Context, onUpdated: ((Double) -> Unit)? = null) {
        val appContext = context.applicationContext
        val token = TokenManager.getToken(appContext)
        if (token.isNullOrBlank()) return

        ApiClient.apiService.getCoinBalance("Bearer $token")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(
                    call: Call<CoinBalanceResponse>,
                    response: Response<CoinBalanceResponse>
                ) {
                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        applyKnownBalance(appContext, body.balance, body.walletId)
                        onUpdated?.invoke(body.balance)
                    } else {
                        Log.w(TAG, "Balance refresh failed: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    Log.w(TAG, "Balance refresh error: ${t.message}")
                }
            })
    }

    fun refreshAfterReward(context: Context, rewardAmount: Number?) {
        val amount = rewardAmount?.toDouble() ?: 0.0
        if (amount <= 0.0) return

        val appContext = context.applicationContext
        val optimisticBalance = TokenManager.getCoinsPrecise(appContext) + amount
        applyKnownBalance(appContext, optimisticBalance, rewardAmount = amount)

        // Reconcile with the server in case another transaction changed the balance.
        refreshBalance(appContext)
    }
}
