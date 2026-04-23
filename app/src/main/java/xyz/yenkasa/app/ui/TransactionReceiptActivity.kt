package xyz.yenkasa.app.ui

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.TransactionUiModel
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.absoluteValue

class TransactionReceiptActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_receipt)

        val transaction = readTransaction()
        val currentWalletId = intent.getStringExtra(EXTRA_CURRENT_WALLET_ID)
        val isOutgoing = currentWalletId != null && transaction.from == currentWalletId
        val amountPrefix = if (isOutgoing) "-" else "+"
        val amountText = "$amountPrefix ${formatCoins(transaction.amount)} YKC"
        val total = if (isOutgoing) transaction.amount + NETWORK_FEE else transaction.amount.toDouble()

        findViewById<TextView>(R.id.textReceiptStatusSubtitle).text = "Transaction Successful"
        findViewById<TextView>(R.id.textReceiptTitle).text = "Transaction Successful"
        findViewById<TextView>(R.id.textReceiptDescription).text = if (isOutgoing) {
            "Your coins have been sent successfully."
        } else {
            "Yenkasa Coins have been received successfully."
        }
        findViewById<TextView>(R.id.textReceiptAmount).text = amountText
        findViewById<TextView>(R.id.textReceiptUsd).text = "≈ ${formatUsd(transaction.amount)} USD"

        findViewById<TextView>(R.id.textReceiptTransactionId).text = shorten(transaction.transactionId)
        findViewById<TextView>(R.id.textReceiptDate).text = formatDate(transaction.createdAt)
        findViewById<TextView>(R.id.textReceiptStatus).text = "• Success"
        findViewById<TextView>(R.id.textReceiptNetwork).text = "Yenkasa Chain"
        findViewById<TextView>(R.id.textReceiptBlock).text =
            "#${buildBlockNumber(transaction.transactionId)}"
        findViewById<TextView>(R.id.textReceiptConfirmations).text = "12"

        findViewById<TextView>(R.id.textReceiptFrom).text =
            if (isOutgoing) "You\n${shorten(transaction.from)}" else displayParty(transaction.senderUsername, transaction.from)
        findViewById<TextView>(R.id.textReceiptTo).text =
            if (isOutgoing) displayParty(transaction.recipientUsername, transaction.to) else "You\n${shorten(transaction.to)}"
        findViewById<TextView>(R.id.textReceiptSummaryAmount).text =
            "${formatCoins(transaction.amount)} YKC\n≈ ${formatUsd(transaction.amount)} USD"
        findViewById<TextView>(R.id.textReceiptFee).text =
            "${formatCoins(NETWORK_FEE)} YKC\n≈ ${formatUsd(NETWORK_FEE)} USD"
        findViewById<TextView>(R.id.textReceiptTotal).text =
            "${formatCoins(total)} YKC\n≈ ${formatUsd(total)} USD"

        findViewById<android.view.View>(R.id.buttonReceiptBack).setOnClickListener { finish() }
        findViewById<android.view.View>(R.id.buttonReceiptShare).setOnClickListener {
            shareReceipt(transaction, amountText)
        }
        findViewById<android.view.View>(R.id.navReceiptHome).setOnClickListener {
            startActivity(
                Intent(this, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
            )
            finish()
        }
        findViewById<android.view.View>(R.id.navReceiptWallet).setOnClickListener {
            startActivity(Intent(this, CoinWalletActivity::class.java))
            finish()
        }
        findViewById<android.view.View>(R.id.navReceiptTransaction).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java))
        }
        findViewById<android.view.View>(R.id.navReceiptReceive).setOnClickListener {
            startActivity(Intent(this, CreateTransactionActivity::class.java).putExtra("action", "receive"))
        }
        findViewById<android.view.View>(R.id.navReceiptProfile).setOnClickListener {
            startActivity(Intent(this, AccountInfoActivity::class.java))
        }
    }

    private fun readTransaction(): TransactionUiModel {
        return TransactionUiModel(
            transactionId = intent.getStringExtra(EXTRA_TRANSACTION_ID).orEmpty(),
            amount = intent.getIntExtra(EXTRA_AMOUNT, 0),
            from = intent.getStringExtra(EXTRA_FROM).orEmpty(),
            to = intent.getStringExtra(EXTRA_TO).orEmpty(),
            newBalance = 0,
            senderUsername = intent.getStringExtra(EXTRA_SENDER),
            recipientUsername = intent.getStringExtra(EXTRA_RECIPIENT),
            description = intent.getStringExtra(EXTRA_DESCRIPTION).orEmpty(),
            type = intent.getStringExtra(EXTRA_TYPE).orEmpty(),
            createdAt = intent.getStringExtra(EXTRA_CREATED_AT).orEmpty(),
            activityId = intent.getStringExtra(EXTRA_ACTIVITY_ID)
        )
    }

    private fun displayParty(username: String?, walletId: String): String {
        return listOfNotNull(username?.takeIf { it.isNotBlank() }, shorten(walletId).takeIf { it.isNotBlank() })
            .joinToString("\n")
            .ifBlank { "Unknown" }
    }

    private fun shorten(value: String): String {
        return if (value.length <= 16) value else "${value.take(7)}...${value.takeLast(6)}"
    }

    private fun formatCoins(amount: Int): String {
        return formatCoins(amount.toDouble())
    }

    private fun formatCoins(amount: Double): String {
        return NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }.format(amount)
    }

    private fun formatUsd(amount: Int): String {
        return formatUsd(amount.toDouble())
    }

    private fun formatUsd(amount: Double): String {
        return NumberFormat.getCurrencyInstance(Locale.US).format(amount * YKC_USD_ESTIMATE)
    }

    private fun formatDate(value: String): String {
        return try {
            value.toLongOrNull()?.let { millis ->
                return SimpleDateFormat("MMM d, yyyy • hh:mm a", Locale.getDefault()).format(Date(millis))
            }

            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(value) ?: return value
            SimpleDateFormat("MMM d, yyyy • hh:mm a", Locale.getDefault()).format(date)
        } catch (_: Exception) {
            value.ifBlank { "Pending" }
        }
    }

    private fun buildBlockNumber(transactionId: String): String {
        val seed = transactionId.hashCode().absoluteValue % 900_000
        return NumberFormat.getIntegerInstance(Locale.US).format(100_000 + seed)
    }

    private fun shareReceipt(transaction: TransactionUiModel, amountText: String) {
        val shareText = "Yenkasa transaction ${transaction.transactionId}: $amountText"
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, shareText),
                "Share receipt"
            )
        )
    }

    companion object {
        private const val NETWORK_FEE = 0.10
        private const val YKC_USD_ESTIMATE = 0.457
        private const val EXTRA_TRANSACTION_ID = "transaction_id"
        private const val EXTRA_AMOUNT = "amount"
        private const val EXTRA_FROM = "from"
        private const val EXTRA_TO = "to"
        private const val EXTRA_SENDER = "sender"
        private const val EXTRA_RECIPIENT = "recipient"
        private const val EXTRA_DESCRIPTION = "description"
        private const val EXTRA_TYPE = "type"
        private const val EXTRA_CREATED_AT = "created_at"
        private const val EXTRA_ACTIVITY_ID = "activity_id"
        private const val EXTRA_CURRENT_WALLET_ID = "current_wallet_id"

        fun createIntent(
            context: Context,
            transaction: TransactionUiModel,
            currentWalletId: String?
        ): Intent {
            return Intent(context, TransactionReceiptActivity::class.java)
                .putExtra(EXTRA_TRANSACTION_ID, transaction.transactionId)
                .putExtra(EXTRA_AMOUNT, transaction.amount)
                .putExtra(EXTRA_FROM, transaction.from)
                .putExtra(EXTRA_TO, transaction.to)
                .putExtra(EXTRA_SENDER, transaction.senderUsername)
                .putExtra(EXTRA_RECIPIENT, transaction.recipientUsername)
                .putExtra(EXTRA_DESCRIPTION, transaction.description)
                .putExtra(EXTRA_TYPE, transaction.type)
                .putExtra(EXTRA_CREATED_AT, transaction.createdAt)
                .putExtra(EXTRA_ACTIVITY_ID, transaction.activityId)
                .putExtra(EXTRA_CURRENT_WALLET_ID, currentWalletId)
        }
    }
}
