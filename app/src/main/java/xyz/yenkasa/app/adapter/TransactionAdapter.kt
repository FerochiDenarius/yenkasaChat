package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.TransactionUiModel
import java.text.SimpleDateFormat
import java.util.*

class TransactionAdapter(
    private val transactions: List<TransactionUiModel>,
    private val currentWalletId: String? = null // optional
) : RecyclerView.Adapter<TransactionAdapter.TransactionViewHolder>() {

    class TransactionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvDescription: TextView = itemView.findViewById(R.id.tvDescription)
        val tvType: TextView = itemView.findViewById(R.id.tvType)
        val tvDate: TextView = itemView.findViewById(R.id.tvDate)
        val tvAmount: TextView = itemView.findViewById(R.id.tvAmount)
        val tvStatus: TextView = itemView.findViewById(R.id.tvStatus)
        val imgType: ImageView = itemView.findViewById(R.id.imgType)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TransactionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transaction, parent, false)
        return TransactionViewHolder(view)
    }

    override fun onBindViewHolder(holder: TransactionViewHolder, position: Int) {
        val tx = transactions[position]

        // Determine direction if currentWalletId is provided
        val isOutgoing = currentWalletId != null && tx.from == currentWalletId
        val otherParty = if (isOutgoing) tx.recipientUsername ?: tx.to else tx.senderUsername ?: tx.from

        holder.tvDescription.text = tx.description.ifEmpty { "Transfer with $otherParty" }
        holder.tvType.text = tx.type.ifEmpty { "WALLET_TRANSACTION" }.uppercase(Locale.getDefault())

        holder.tvDate.text = formatDate(tx.createdAt)
        holder.tvStatus.text = "Confirmed"

        val displayAmount = if (isOutgoing) "-${tx.amount} YKC" else "+${tx.amount} YKC"
        holder.tvAmount.text = displayAmount

        val colorRes = if (isOutgoing) R.color.wallet_negative else R.color.wallet_accent_green
        holder.tvAmount.setTextColor(ContextCompat.getColor(holder.itemView.context, colorRes))
        holder.tvStatus.setTextColor(ContextCompat.getColor(holder.itemView.context, R.color.wallet_accent_green))
        holder.imgType.setImageResource(R.drawable.ic_coin)
    }

    override fun getItemCount(): Int = transactions.size

    private fun formatDate(isoDate: String): String {
        return try {
            isoDate.toLongOrNull()?.let { millis ->
                return SimpleDateFormat("MMM d, yyyy - hh:mm a", Locale.getDefault()).format(Date(millis))
            }

            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(isoDate)
            SimpleDateFormat("MMM d, yyyy - hh:mm a", Locale.getDefault()).format(date!!)
        } catch (e: Exception) {
            isoDate
        }
    }
}
