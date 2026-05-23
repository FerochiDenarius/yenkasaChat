package xyz.yenkasa.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.*
import xyz.yenkasa.app.network.ApiClient
import xyz.yenkasa.app.util.AppLocalStore
import xyz.yenkasa.app.util.TokenManager
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response
import java.util.Locale
import java.util.UUID

class CreateTransactionActivity : AppCompatActivity() {

    private lateinit var tvWalletId: TextView
    private lateinit var btnCopyWalletId: Button
    private lateinit var etRecipientId: EditText
    private lateinit var etAmount: EditText
    private lateinit var btnSend: Button
    private lateinit var progressBar: ProgressBar
    private var currentWalletId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_create_transaction)

        tvWalletId = findViewById(R.id.tvWalletId)
        btnCopyWalletId = findViewById(R.id.btnCopyWalletId)
        etRecipientId = findViewById(R.id.etRecipientId)
        etAmount = findViewById(R.id.etAmount)
        btnSend = findViewById(R.id.btnSend)
        progressBar = findViewById(R.id.progressBar)

        val action = intent.getStringExtra("action")

        if (action == "receive") {
            findViewById<View>(R.id.layoutSendCoins).visibility = View.GONE
        }

        findViewById<View>(R.id.buttonBackTransaction).setOnClickListener { finish() }
        findViewById<View>(R.id.buttonTransactionHistory).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
        }
        findViewById<View>(R.id.buttonTransactionScan).setOnClickListener {
            Toast.makeText(this, getString(R.string.wallet_scan_unavailable), Toast.LENGTH_SHORT).show()
        }
        findViewById<View>(R.id.textTransactionMax).setOnClickListener {
            Toast.makeText(this, getString(R.string.transaction_max_unavailable), Toast.LENGTH_SHORT).show()
        }
        findViewById<View>(R.id.navTransactionHome).setOnClickListener {
            startActivity(
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
            )
            finish()
        }
        findViewById<View>(R.id.navTransactionWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
            finish()
        }
        findViewById<View>(R.id.navTransactionActive).setOnClickListener {
            Toast.makeText(this, getString(R.string.transaction_already_here), Toast.LENGTH_SHORT).show()
        }
        findViewById<View>(R.id.navTransactionReceive).setOnClickListener {
            findViewById<View>(R.id.layoutSendCoins).visibility = View.GONE
        }
        findViewById<View>(R.id.navTransactionProfile).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }

        fetchWalletId()

        btnCopyWalletId.setOnClickListener {
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText(getString(R.string.copy_wallet_id), tvWalletId.text.toString())
            clipboard.setPrimaryClip(clip)
            Toast.makeText(this, getString(R.string.wallet_id_copied), Toast.LENGTH_SHORT).show()
        }

        btnSend.setOnClickListener {
            val recipientWalletId = etRecipientId.text.toString().trim()
            val amountText = etAmount.text.toString().trim()

            if (recipientWalletId.isEmpty() || amountText.isEmpty()) {
                Toast.makeText(this, getString(R.string.please_fill_all_fields), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val amount = amountText.toIntOrNull()
            if (amount == null || amount <= 0) {
                Toast.makeText(this, getString(R.string.enter_valid_amount), Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            fetchRecipientUsernameAndSend(recipientWalletId, amount)
        }
    }

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
                    val body = response.body()
                    if (response.isSuccessful && body != null && body.success) {
                        currentWalletId = body.walletId
                        tvWalletId.text = body.walletId ?: getString(R.string.not_available_short)
                    } else {
                        tvWalletId.text = getString(R.string.not_available_short)
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            getString(R.string.failed_to_fetch_wallet_info),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<CoinBalanceResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    tvWalletId.text = getString(R.string.not_available_short)
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun fetchRecipientUsernameAndSend(walletId: String, amount: Int) {
        val token = TokenManager.getToken(this) ?: return
        progressBar.visibility = View.VISIBLE
        btnSend.isEnabled = false

        ApiClient.apiService.getUsernameByWalletId("Bearer $token", walletId)
            .enqueue(object : Callback<User> {
                override fun onResponse(call: Call<User>, response: Response<User>) {
                    progressBar.visibility = View.GONE
                    if (response.isSuccessful && response.body() != null) {
                        val username = response.body()!!.username
                        sendCoins(walletId, username, amount)
                    } else {
                        btnSend.isEnabled = true
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            getString(R.string.recipient_not_found),
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                }

                override fun onFailure(call: Call<User>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    btnSend.isEnabled = true
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun sendCoins(recipientWalletId: String, recipientUsername: String?, amount: Int) {
        val token = TokenManager.getToken(this) ?: return
        progressBar.visibility = View.VISIBLE
        btnSend.isEnabled = false
        val activityId = createTransferActivityId(recipientWalletId, amount)

        val request = TransferCoinsRequest(
            toWalletId = recipientWalletId,
            recipientUsername = recipientUsername,
            amount = amount,
            message = "Transfer from mobile app",
            activityId = activityId,
            clientTransactionId = activityId,
            idempotencyKey = activityId
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
                        val recipientLabel = recipientUsername ?: getString(R.string.unknown)
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            getString(R.string.transaction_sent_success_format, amount, recipientLabel),
                            Toast.LENGTH_LONG
                        ).show()

                        // ✅ Build and save the transaction locally
                        // ✅ Build and save the transaction locally using TransactionInfo from response
                        val tx = body.transaction
                        val newTransaction = TransactionUiModel(
                            transactionId = tx?.transactionId ?: activityId,
                            amount = (tx?.amount ?: amount).toDouble(),
                            from = tx?.fromWalletId ?: TokenManager.getUserId(this@CreateTransactionActivity) ?: "",
                            to = tx?.toWalletId ?: recipientWalletId,
                            newBalance = (tx?.toUserBalanceAfter ?: 0).toDouble(),
                            senderUsername = tx?.fromUsername ?: TokenManager.getUsername(this@CreateTransactionActivity),
                            recipientUsername = tx?.toUsername ?: recipientUsername ?: "",
                            description = getString(R.string.transaction_sent_description_format, amount, recipientLabel),
                            type = "transfer",
                            createdAt = tx?.createdAt ?: System.currentTimeMillis().toString(),
                            activityId = tx?.activityId ?: activityId
                        )

                        val existing = AppLocalStore.getTransactionHistory(this@CreateTransactionActivity).toMutableList()
                        existing.add(0, newTransaction)
                        AppLocalStore.saveTransactionHistory(this@CreateTransactionActivity, existing)

                        openReceipt(newTransaction)
                        finish()
                    } else {
                        btnSend.isEnabled = true
                        val errorMsg = body?.error ?: response.message()
                        Toast.makeText(
                            this@CreateTransactionActivity,
                            getString(R.string.transaction_failed_with_message, errorMsg),
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }

                override fun onFailure(call: Call<TransferCoinsResponse>, t: Throwable) {
                    progressBar.visibility = View.GONE
                    btnSend.isEnabled = true
                    Toast.makeText(
                        this@CreateTransactionActivity,
                        getString(R.string.network_error_with_message, t.message ?: getString(R.string.unknown)),
                        Toast.LENGTH_SHORT
                    ).show()
                }
            })
    }

    private fun createTransferActivityId(recipientWalletId: String, amount: Int): String {
        val senderId = TokenManager.getUserId(this).orEmpty().ifBlank { "unknown" }
        val normalizedRecipient = recipientWalletId.lowercase(Locale.US)
            .replace(Regex("[^a-z0-9_-]"), "")
            .take(24)
            .ifBlank { "recipient" }
        return "ykc_transfer_${senderId.take(12)}_${normalizedRecipient}_${amount}_${UUID.randomUUID()}"
    }

    private fun openReceipt(transaction: TransactionUiModel) {
        startActivity(
            TransactionReceiptActivity.createIntent(
                context = this,
                transaction = transaction,
                currentWalletId = currentWalletId
            )
        )
    }
}
