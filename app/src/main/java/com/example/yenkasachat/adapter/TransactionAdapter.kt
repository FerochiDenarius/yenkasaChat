package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat // ✅ 1. ADD THIS IMPORT
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.CoinTransaction
import java.text.SimpleDateFormat
import java.util.*

class TransactionAdapter(private val transactions: List<CoinTransaction>) :
    RecyclerView.Adapter<TransactionAdapter.TransactionViewHolder>() {

    class TransactionViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val tvDescription: TextView = itemView.findViewById(R.id.tvDescription)
        val tvType: TextView = itemView.findViewById(R.id.tvType)
        val tvDate: TextView = itemView.findViewById(R.id.tvDate)
        val tvAmount: TextView = itemView.findViewById(R.id.tvAmount)
        val imgType: ImageView = itemView.findViewById(R.id.imgType)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TransactionViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_transaction, parent, false)
        return TransactionViewHolder(view)
    }

    override fun onBindViewHolder(holder: TransactionViewHolder, position: Int) {
        val transaction = transactions[position]
        holder.tvDescription.text = transaction.description
        holder.tvType.text = transaction.type
        holder.tvDate.text = formatDate(transaction.createdAt)
        holder.tvAmount.text = formatAmount(transaction.amount)

        // ✅ 2. FIX: Use the compatibility method ContextCompat.getColor()
        val colorRes = if (transaction.amount > 0) R.color.green else R.color.red
        holder.tvAmount.setTextColor(ContextCompat.getColor(holder.itemView.context, colorRes))
    }

    override fun getItemCount(): Int = transactions.size

    private fun formatDate(isoDate: String): String {
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault())
            parser.timeZone = TimeZone.getTimeZone("UTC") // Good practice to set the timezone for parsing
            val date = parser.parse(isoDate)
            SimpleDateFormat("MMM d, yyyy", Locale.getDefault()).format(date!!)
        } catch (e: Exception) {
            isoDate
        }
    }

    private fun formatAmount(amount: Int): String {
        return if (amount > 0) "+$amount" else "$amount"
    }
}
