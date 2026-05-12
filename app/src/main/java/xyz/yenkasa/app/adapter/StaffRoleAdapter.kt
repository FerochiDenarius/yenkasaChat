package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.RoleUser

class StaffRoleAdapter(
    private val onSuspendClick: (RoleUser) -> Unit,
    private val onMoreClick: (View, RoleUser) -> Unit
) : ListAdapter<RoleUser, StaffRoleAdapter.RoleUserViewHolder>(DiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RoleUserViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_staff_role, parent, false)
        return RoleUserViewHolder(view)
    }

    override fun onBindViewHolder(holder: RoleUserViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class RoleUserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val initials: TextView = itemView.findViewById(R.id.textInitials)
        private val username: TextView = itemView.findViewById(R.id.textUsername)
        private val email: TextView = itemView.findViewById(R.id.textEmail)
        private val roleBadge: TextView = itemView.findViewById(R.id.textRoleBadge)
        private val suspendButton: TextView = itemView.findViewById(R.id.buttonSuspend)
        private val moreButton: TextView = itemView.findViewById(R.id.buttonMore)

        fun bind(user: RoleUser) {
            initials.text = user.initials()
            username.text = user.username?.ifBlank { "Yenkasa user" } ?: "Yenkasa user"
            email.text = user.email?.ifBlank { "No email" } ?: "No email"
            roleBadge.text = formatRole(user.displayRole(), user.publicRoles)
            suspendButton.text = if (user.suspendedUntil.isNullOrBlank()) "X" else "+"
            suspendButton.setOnClickListener { onSuspendClick(user) }
            moreButton.setOnClickListener { onMoreClick(it, user) }
        }
    }

    private fun formatRole(primary: String, publicRoles: List<String>): String {
        val label = primary.replace("_", " ").replaceFirstChar { it.uppercase() }
        if (publicRoles.isEmpty()) return label
        return "$label +${publicRoles.size}"
    }

    private object DiffCallback : DiffUtil.ItemCallback<RoleUser>() {
        override fun areItemsTheSame(oldItem: RoleUser, newItem: RoleUser): Boolean {
            return oldItem.resolvedId() == newItem.resolvedId()
        }

        override fun areContentsTheSame(oldItem: RoleUser, newItem: RoleUser): Boolean {
            return oldItem == newItem
        }
    }
}
