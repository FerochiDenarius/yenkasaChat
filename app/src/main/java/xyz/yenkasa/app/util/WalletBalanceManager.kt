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
    const val EXTRA_WALLET_ID = "extra_wallet_id"

    private const val TAG = "WalletBalanceManager"

    fun applyKnownBalance(context: Context, balance: Int, walletId: String? = null) {
        val appContext = context.applicationContext
        TokenManager.saveCoins(appContext, balance)
        appContext.sendBroadcast(
            Intent(ACTION_BALANCE_UPDATED)
                .setPackage(appContext.packageName)
                .putExtra(EXTRA_BALANCE, balance)
                .putExtra(EXTRA_WALLET_ID, walletId)
        )
    }

    fun refreshBalance(context: Context, onUpdated: ((Int) -> Unit)? = null) {
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

    fun refreshAfterReward(context: Context, rewardAmount: Int?) {
        if ((rewardAmount ?: 0) > 0) {
            refreshBalance(context)
        }
    }
}
