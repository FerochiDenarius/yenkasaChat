package com.example.yenkasachat.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.example.yenkasachat.R
import com.example.yenkasachat.model.TransferCoinsRequest
import com.example.yenkasachat.model.TransferCoinsResponse
import com.example.yenkasachat.model.CoinBalanceResponse
import com.example.yenkasachat.model.User
import com.example.yenkasachat.network.ApiClient
import com.example.yenkasachat.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class CreateTransactionActivity : AppCompatActivity() {

    private lateinit var tvWalletId: TextView
    private lateinit var btnCopyWalletId: Button
    private lateinit var etRecipientId: EditText
    private lateinit var etAmount: EditText
    private lateinit var btnSend: Button
    private lateinit var progressBar: ProgressBar

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_transaction)

        // Initialize UI
        tvWalletId = findViewById(R.id.tvWalletId)
        btnCopyWalletId = findViewById(R.id.btnCopyWalletId)
        etRecipientId = findViewById(R.id.etRecipientId)
        etAmount = findViewById(R.id.etAmount)
        btnSend = findViewById(R.id.btnSend)
        progressBar = findViewById(R.id.progressBar)

        val action = intent.getStringExtra("action")

        if (action == "receive") {
            etRecipientId.visibility = View.GONE
            etAmount.visibility = View.GONE
            btnSend.visibility = View.GONE
        }

        // 🪙 Fetch wallet ID from server
        fetchWalletId()

        // 📋 Copy wallet ID
        btnCopyWalletId.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("Wallet ID", tvWalletId.text.toString())
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, "Wallet ID copied to clipboard", Toast.LENGTH_SHORT).show()
        }

        // 💸 Send coins
        btnSend.setOnClickListener {
            val recipientWalletId = etRecipientId.text.toString().trim()
            val amountText = etAmount.text.toString().trim()

            if (recipientWalletId.isEmpty() || amountText.isEmpty()) {
                Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val amount = amountText.toIntOrNull()
            if (amount == null || amount <= 0) {
                Toast.makeText(this, "Enter a valid amount", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            fetchRecipientUsernameAndSend(recipientWalletId, amount)
        }
    }

    // ✅ Fetch wallet ID from /coins/balance endpoint
    private fun fetchWalletId() {
        val token = TokenManager.getToken(this) ?: return

        progressBar.visibility = View.VISIBLE

        ApiClient.apiService.getCoinBalance("Bearer $token")
            .enqueue(object : Callback<CoinBalanceResponse> {
                override fun onResponse(
                    call: Call<CoinBalanceResponse>,
                    response: Response<CoinBalanceResponse>
                ) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful && response.body() != null) {
                        val data = response.body()!!
                        tvWalletId.text = data.walletId ?: "N/A"
                    } else {
                        tvWalletId.text = "N/A"
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            "Failed to fetch wallet info",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    tvWalletId.text = "N/A"
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    // 🔹 New method: fetch recipient username before sending
    private fun fetchRecipientUsernameAndSend(walletId: String, amount: Int) {
        val token = TokenManager.getToken(this) ?: return

        progressBar.visibility = View.VISIBLE

        // Call backend API to get username for walletId
        ApiClient.apiService.getUsernameByWalletId("Bearer $token", walletId)
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful && response.body() != null) {
                        val recipientUsername = response.body()!!.username
                        sendCoins(walletId, recipientUsername, amount)
                    } else {
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            "Failed to fetch recipient username",
                            Toast.LENGTH_SHORT
                        ).show()
                    }

                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    // ✅ Send coins to another user (now includes recipientUsername)
    private fun sendCoins(recipientWalletId: String, recipientUsername: String?, amount: Int) {
        val token = TokenManager.getToken(this) ?: return

        progressBar.visibility = View.VISIBLE

        val request = TransferCoinsRequest(
            toWalletId = recipientWalletId,
            recipientUsername = recipientUsername,   // <-- automatically filled
            amount = amount,
            message = "Transfer from mobile app"
        )

        ApiClient.apiService.transferCoins("Bearer $token", request)
            .enqueue(object : Callback<TransferCoinsResponse> {
                override fun onResponse(
                    call: Call<TransferCoinsResponse>,
                    response: Response<TransferCoinsResponse>
                ) {
                    progressBar.visibility = View.GONE
                    val body = response.body()
                    if (response.isSuccessful && body?.success == true) {
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            "✅ Sent $amount coins to $recipientUsername",
                            Toast.LENGTH_LONG
                        ).show()
                        finish()
                    } else {
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            body?.error ?: "❌ Transaction failed",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<TransferCoinsResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        "Network error: ${t.message}",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }
}
