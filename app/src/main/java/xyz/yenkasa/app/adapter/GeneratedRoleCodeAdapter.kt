package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.GeneratedRoleCode

class GeneratedRoleCodeAdapter(
    private val onCopyClick: (GeneratedRoleCode) -> Unit
) : ListAdapter<GeneratedRoleCode, GeneratedRoleCodeAdapter.GeneratedRoleViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): GeneratedRoleViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_generated_role, parent, false)
        return GeneratedRoleViewHolder(view)
    }

    override fun onBindViewHolder(holder: GeneratedRoleViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class GeneratedRoleViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val label: TextView = itemView.findViewById(R.id.textGeneratedRoleLabel)
        private val code: TextView = itemView.findViewById(R.id.textGeneratedCode)
        private val expiry: TextView = itemView.findViewById(R.id.textGeneratedExpiry)
        private val copyButton: TextView = itemView.findViewById(R.id.buttonCopyCode)

        fun bind(item: GeneratedRoleCode) {
            label.text = item.roleLabel ?: item.roleKey?.replace("_", " ") ?: "Generated Role ID"
            code.text = item.code ?: "Pending"
            val usedCopy = if (item.usedAt.isNullOrBlank()) "" else "Used"
            expiry.text = usedCopy.ifBlank { "Expires: ${item.expiresAt ?: "7 days"}" }
            copyButton.isEnabled = !item.code.isNullOrBlank()
            copyButton.alpha = if (copyButton.isEnabled) 1f else 0.5f
            copyButton.setOnClickListener { onCopyClick(item) }
        }
    }

    private object DiffCallback : DiffUtil.ItemCallback<GeneratedRoleCode>() {
        override fun areItemsTheSame(oldItem: GeneratedRoleCode, newItem: GeneratedRoleCode): Boolean {
            return oldItem.code == newItem.code
        }

        override fun areContentsTheSame(oldItem: GeneratedRoleCode, newItem: GeneratedRoleCode): Boolean {
            return oldItem == newItem
        }
    }
}
