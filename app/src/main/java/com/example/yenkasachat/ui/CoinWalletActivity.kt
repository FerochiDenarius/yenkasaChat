package com.example.yenkasachat.ui

import android.app.NotificationManager
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.MyApplication
import com.example.yenkasachat.R
import com.example.yenkasachat.adapter.TransactionAdapter
import com.example.yenkasachat.model.TransactionUiModel
import com.example.yenkasachat.model.CoinTransactionResponse
import com.example.yenkasachat.model.CoinBalanceResponse
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import android.content.Intent


class CoinWalletActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvBalanceLabel: TextView
    private lateinit var tvBalance: TextView
    private lateinit var btnTransaction: Button
    private lateinit var recyclerViewTransactions: RecyclerView
    private lateinit var transactionAdapter: TransactionAdapter

    private val transactionList = mutableListOf<TransactionUiModel>()

    // Track old transaction list to detect NEW rewards
    private var previousList: List<TransactionUiModel> = emptyList()

    private val TAG = "CoinWalletActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_coin_wallet)

        // UI
        tvTitle = findViewById(R.id.tvTitle)
        tvBalanceLabel = findViewById(R.id.tvBalanceLabel)
        tvBalance = findViewById(R.id.tvBalance)
        btnTransaction = findViewById(R.id.btnTransaction)
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions)

        tvTitle.text = "Coin Wallet"
        tvBalanceLabel.text = "Current Balance"

        // RecyclerView
        transactionAdapter = TransactionAdapter(transactionList)
        recyclerViewTransactions.apply {
            layoutManager = LinearLayoutManager(this@CoinWalletActivity)
            adapter = transactionAdapter
        }

        btnTransaction.setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java))
        }

        loadWalletData()
    }

    private fun loadWalletData() {
        val token = TokenManager.getToken(this) ?: return

        // Load balance
        ApiClient.apiService.getCoinBalance("Bearer $token")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(call: Call<CoinBalanceResponse>, response: Response<CoinBalanceResponse>) {
                    if (response.isSuccessful && response.body() != null) {
                        tvBalance.text = "YenkasaCoins: ${response.body()!!.balance}"
                    } else {
                        tvBalance.text = "YenkasaCoins: 0"
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    tvBalance.text = "YenkasaCoins: 0"
                }
            })

        // Load cached transactions
        val cached = TokenManager.getTransactionHistory(this)
            .filter { !it.activityId.isNullOrEmpty() }

        if (cached.isNotEmpty()) {
            transactionList.clear()
            transactionList.addAll(cached)
            transactionAdapter.notifyDataSetChanged()
            previousList = cached // STORE previous list baseline
        }

        // Fetch latest from server
        ApiClient.apiService.getCoinTransactionHistory("Bearer $token")
            .enqueue(object : Callback<CoinTransactionResponse> {
                override fun onResponse(
                    call: Call<CoinTransactionResponse>,
                    response: Response<CoinTransactionResponse>
                ) {
                    if (!response.isSuccessful || response.body() == null) {
                        Toast.makeText(this@CoinWalletActivity, "Failed to load transactions", Toast.LENGTH_SHORT).show()
                        return
                    }

                    val latest = response.body()!!.transactions
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

                    // Detect new rewards
                    val newItems = latest.filter { newTx ->
                        previousList.none { oldTx -> oldTx.transactionId == newTx.transactionId }
                    }

                    // Trigger sound notification for each reward
                    if (newItems.isNotEmpty()) {
                        newItems.forEach { tx ->
                            triggerRewardNotification(tx)
                        }
                    }

                    // Update UI
                    transactionList.clear()
                    transactionList.addAll(latest)
                    transactionAdapter.notifyDataSetChanged()

                    // Save to local cache
                    TokenManager.saveTransactionHistory(this@CoinWalletActivity, latest)

                    // Update previous list
                    previousList = latest
                }

                override fun onFailure(call: Call<CoinTransactionResponse>, t: Throwable) {
                    Toast.makeText(this@CoinWalletActivity, "Failed to load transactions", Toast.LENGTH_SHORT).show()
                }
            })
    }


    // 🔥 Play sound + show notification for rewards
    private fun triggerRewardNotification(tx: TransactionUiModel) {
        val prefs = getSharedPreferences("settings", MODE_PRIVATE)
        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"

        val rawRes = resources.getIdentifier(selectedSound, "raw", packageName)
        val soundUri = Uri.parse("android.resource://$packageName/$rawRes")

        val title = "Reward Earned!"
        val body = tx.description ?: "You received ${tx.amount} YKC"

        val builder = NotificationCompat.Builder(
            this,
            MyApplication.NEW_CHAT_MESSAGES_CHANNEL_ID
        )
            .setSmallIcon(R.drawable.ic_coin)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setSound(soundUri)

        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), builder.build())
    }


    override fun onResume() {
        super.onResume()
        loadWalletData()
    }
}
