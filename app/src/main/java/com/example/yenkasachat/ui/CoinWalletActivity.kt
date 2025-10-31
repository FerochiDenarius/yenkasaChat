package com.example.yenkasachat.ui

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R

class CoinWalletActivity : AppCompatActivity() {

    private lateinit var tvTitle: TextView
    private lateinit var tvBalanceLabel: TextView
    private lateinit var tvBalance: TextView
    private lateinit var btnTransaction: Button
    private lateinit var recyclerViewTransactions: RecyclerView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_coin_wallet)

        // Initialize UI elements
        tvTitle = findViewById(R.id.tvTitle)
        tvBalanceLabel = findViewById(R.id.tvBalanceLabel)
        tvBalance = findViewById(R.id.tvBalance)
        btnTransaction = findViewById(R.id.btnTransaction)
        recyclerViewTransactions = findViewById(R.id.recyclerViewTransactions)

        // Set initial UI
        tvTitle.text = "Coin Wallet"
        tvBalanceLabel.text = "Current Balance"

        // Navigate to CreateTransactionActivity when button clicked
        btnTransaction.setOnClickListener {
            val intent = Intent(this, CreateTransactionActivity::class.java)
            startActivity(intent)
        }

        // TODO: Load balance and transactions from backend
        loadWalletData()
    }

    private fun loadWalletData() {
        // Placeholder for now — you’ll later plug in your Retrofit call here
        tvBalance.text = "100.00"
    }
}
