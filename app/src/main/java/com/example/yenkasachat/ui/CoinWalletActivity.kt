package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.TransactionAdapter
import com.example.yenkasachat.model.TransactionUiModel
import com.example.yenkasachat.model.CoinTransactionResponse
import com.example.yenkasachat.model.CoinBalanceResponse
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CoinWalletActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvBalanceLabel: TextView
    private lateinit var tvBalance: TextView
    private lateinit var btnTransaction: Button
    private lateinit var recyclerViewTransactions: RecyclerView
    private lateinit var transactionAdapter: TransactionAdapter
    private val transactionList = mutableListOf<TransactionUiModel>()


    private val TAG = "CoinWalletActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_coin_wallet)

        // Initialize UI
        tvTitle = findViewById(R.id.tvTitle)
        tvBalanceLabel = findViewById(R.id.tvBalanceLabel)
        tvBalance = findViewById(R.id.tvBalance)
        btnTransaction = findViewById(R.id.btnTransaction)
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions)

        tvTitle.text = "Coin Wallet"
        tvBalanceLabel.text = "Current Balance"

        // Set RecyclerView
        transactionAdapter = TransactionAdapter(transactionList)
        recyclerViewTransactions.apply {
            layoutManager = LinearLayoutManager(this@CoinWalletActivity)
            adapter = transactionAdapter
        }

        // Navigate to CreateTransactionActivity when button clicked
        btnTransaction.setOnClickListener {
            val intent = Intent(this, CreateTransactionActivity::class.java)
            startActivity(intent)
        }

        // Load balance & transactions
        loadWalletData()
    }

    private fun loadWalletData() {
        val token = TokenManager.getToken(this) ?: return

        // ✅ Load wallet balance from backend
        ApiClient.apiService.getCoinBalance("Bearer $token")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(call: Call<CoinBalanceResponse>, response: Response<CoinBalanceResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        val data = response.body()!!
                        tvBalance.text = "YenkasaCoins: ${data.balance}"
                        Log.d(TAG, "✅ Wallet loaded: ${data.balance} coins (Wallet ID: ${data.walletId})")
                    } else {
                        tvBalance.text = "YenkasaCoins: 0"
                        Log.e(TAG, "⚠️ Failed to load wallet balance. Code: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    tvBalance.text = "YenkasaCoins: 0"
                    Log.e(TAG, "❌ Failed to load coin balance: ${t.message}")
                }
            })

        // ✅ Load cached transaction history first (only ones with activityId)
        val cached = TokenManager.getTransactionHistory(this@CoinWalletActivity)
            .filter { !it.activityId.isNullOrEmpty() }

        if (cached.isNotEmpty()) {
            transactionList.clear()
            transactionList.addAll(cached)
            transactionAdapter.notifyDataSetChanged()
            Log.d(TAG, "📦 Loaded ${cached.size} cached transactions")
        }

        // ✅ Fetch latest transaction history from backend
        ApiClient.apiService.getCoinTransactionHistory("Bearer $token")
            .enqueue(object : Callback<CoinTransactionResponse> {
                override fun onResponse(
                    call: Call<CoinTransactionResponse>,
                    response: Response<CoinTransactionResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        val transactions = response.body()!!.transactions
                            .filter { !it.activityId.isNullOrEmpty() }
                            .map {
                                TransactionUiModel(
                                    transactionId = it.transactionId,
                                    amount = it.amount,
                                    from = it.fromWalletId ?: "",
                                    to = it.toWalletId ?: "",
                                    newBalance = 0,
                                    senderUsername = it.fromUsername,
                                    recipientUsername = it.toUsername,
                                    description = it.description,
                                    type = it.type,
                                    createdAt = it.createdAt,
                                    activityId = it.activityId
                                )
                            }

                        transactionList.clear()
                        transactionList.addAll(transactions)
                        transactionAdapter.notifyDataSetChanged()

                        TokenManager.saveTransactionHistory(this@CoinWalletActivity, transactions)
                        Log.d(TAG, "✅ Fetched ${transactions.size} transactions from server")
                    } else {
                        Toast.makeText(this@CoinWalletActivity, "Failed to load transactions", Toast.LENGTH_SHORT).show()
                        Log.e(TAG, "⚠️ Failed to load transactions. Code: ${response.code()}")
                    }
                }

                override fun onFailure(call: Call<CoinTransactionResponse>, t: Throwable) {
                    Toast.makeText(this@CoinWalletActivity, "Failed to load transactions — showing cached data", Toast.LENGTH_SHORT).show()
                    Log.e(TAG, "❌ Transaction fetch error: ${t.message}")
                }
            })
    }

    override fun onResume() {
        super.onResume()
        // Refresh balance & transactions when returning from sending/receiving coins
        loadWalletData()
    }
}
