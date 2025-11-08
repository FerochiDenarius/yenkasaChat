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
import com.example.yenkasachat.model.CoinTransaction
import com.example.yenkasachat.model.CoinTransactionResponse
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
    private val transactionList = mutableListOf<CoinTransaction>()

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

        // ✅ Load user profile for balance
        ApiClient.apiService.getUserProfile()
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    if (response.isSuccessful && response.body() != null) {
                        val user = response.body()!!
                        tvBalance.text = "YenkasaCoins: ${user.coinsBalance ?: 0}"
                    } else {
                        tvBalance.text = "YenkasaCoins: 0"
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    tvBalance.text = "YenkasaCoins: 0"
                    Log.e(TAG, "Failed to load user profile: ${t.message}")
                }
            })

        // ✅ Load transactions
        ApiClient.apiService.getCoinTransactionHistory("Bearer $token")
            .enqueue(object : Callback<CoinTransactionResponse> {
                override fun onResponse(
                    call: Call<CoinTransactionResponse>,
                    response: Response<CoinTransactionResponse>
                ) {
                    if (response.isSuccessful && response.body() != null) {
                        transactionList.clear()
                        transactionList.addAll(response.body()!!.transactions)
                        transactionAdapter.notifyDataSetChanged()
                    } else {
                        Toast.makeText(
                            this@CoinWalletActivity,
                            "Failed to load transactions",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CoinTransactionResponse>, t: Throwable) {
                    Toast.makeText(
                        this@CoinWalletActivity,
                        "Failed to load transactions",
                        Toast.LENGTH_SHORT
                    ).show()
                    Log.e(TAG, "Failed to load transactions: ${t.message}")
                }
            })
    }

    override fun onResume() {
        super.onResume()
        // Refresh balance & transactions when returning from sending/receiving coins
        loadWalletData()
    }
}
