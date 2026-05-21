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
        val amountText = getString(
            R.string.signed_ykc_amount_format,
            amountPrefix,
            formatCoins(transaction.amount)
        )
        val total = if (isOutgoing) transaction.amount + NETWORK_FEE else transaction.amount.toDouble()

        findViewById<TextView>(R.id.textReceiptStatusSubtitle).text = getString(R.string.transaction_successful)
        findViewById<TextView>(R.id.textReceiptTitle).text = getString(R.string.transaction_successful)
        findViewById<TextView>(R.id.textReceiptDescription).text = if (isOutgoing) {
            getString(R.string.transaction_sent_success_description)
        } else {
            getString(R.string.transaction_received_success_description)
        }
        findViewById<TextView>(R.id.textReceiptAmount).text = amountText
        findViewById<TextView>(R.id.textReceiptUsd).text = getString(R.string.transaction_receipt_value_copy)

        findViewById<TextView>(R.id.textReceiptTransactionId).text = shorten(transaction.transactionId)
        findViewById<TextView>(R.id.textReceiptDate).text = formatDate(transaction.createdAt)
        findViewById<TextView>(R.id.textReceiptStatus).text = getString(R.string.transaction_status_success)
        findViewById<TextView>(R.id.textReceiptNetwork).text = getString(R.string.yenkasa_chain)
        findViewById<TextView>(R.id.textReceiptBlock).text =
            getString(R.string.block_number_format, buildBlockNumber(transaction.transactionId))
        findViewById<TextView>(R.id.textReceiptConfirmations).text = getString(R.string.transaction_confirmations_count, 12)

        findViewById<TextView>(R.id.textReceiptFrom).text =
            if (isOutgoing) {
                getString(R.string.user_wallet_summary_format, getString(R.string.you), shorten(transaction.from))
            } else {
                displayParty(transaction.senderUsername, transaction.from)
            }
        findViewById<TextView>(R.id.textReceiptTo).text =
            if (isOutgoing) {
                displayParty(transaction.recipientUsername, transaction.to)
            } else {
                getString(R.string.user_wallet_summary_format, getString(R.string.you), shorten(transaction.to))
            }
        findViewById<TextView>(R.id.textReceiptSummaryAmount).text =
            getString(R.string.ykc_amount_format, formatCoins(transaction.amount))
        findViewById<TextView>(R.id.textReceiptFee).text =
            getString(R.string.ykc_amount_format, formatCoins(NETWORK_FEE))
        findViewById<TextView>(R.id.textReceiptTotal).text =
            getString(R.string.ykc_amount_format, formatCoins(total))

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
            amount = intent.getDoubleExtra(EXTRA_AMOUNT, 0.0),
            from = intent.getStringExtra(EXTRA_FROM).orEmpty(),
            to = intent.getStringExtra(EXTRA_TO).orEmpty(),
            newBalance = 0.0,
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
            .ifBlank { getString(R.string.unknown) }
    }

    private fun shorten(value: String): String {
        return if (value.length <= 16) value else "${value.take(7)}...${value.takeLast(6)}"
    }

    private fun formatCoins(amount: Double): String {
        return NumberFormat.getNumberInstance(Locale.getDefault()).apply {
            minimumFractionDigits = 2
            maximumFractionDigits = 2
        }.format(amount)
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
            value.ifBlank { getString(R.string.pending) }
        }
    }

    private fun buildBlockNumber(transactionId: String): String {
        val seed = transactionId.hashCode().absoluteValue % 900_000
        return NumberFormat.getIntegerInstance(Locale.US).format(100_000 + seed)
    }

    private fun shareReceipt(transaction: TransactionUiModel, amountText: String) {
        val shareText = getString(
            R.string.transaction_share_text_format,
            transaction.transactionId,
            amountText
        )
        startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND)
                    .setType("text/plain")
                    .putExtra(Intent.EXTRA_TEXT, shareText),
                getString(R.string.transaction_receipt_share_title)
            )
        )
    }

    companion object {
        private const val NETWORK_FEE = 0.10
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
