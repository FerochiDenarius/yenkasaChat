package xyz.yenkasa.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Contact

class GroupMembersAdapter(
    private val selectedIds: Set<String>,
    private val onToggle: (Contact) -> Unit
) : ListAdapter<Contact, GroupMembersAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_group_member_select, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val contact = getItem(position)
        val stableId = contact.contactId ?: contact._id ?: contact.userId
        holder.name.text = contact.username
        holder.status.text = if (contact.online || contact.isOnline) "Online" else "Yenkasa contact"
        holder.checkBox.isChecked = selectedIds.contains(stableId)
        holder.itemView.setOnClickListener {
            onToggle(contact)
            holder.checkBox.animate().scaleX(0.82f).scaleY(0.82f).setDuration(80L).withEndAction {
                holder.checkBox.animate().scaleX(1f).scaleY(1f).setDuration(100L).start()
            }.start()
        }

        Glide.with(holder.itemView.context)
            .load(contact.profileImage ?: contact.profilePicture.orEmpty())
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(holder.avatar)
    }

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val avatar: ImageView = itemView.findViewById(R.id.imageContactAvatar)
        val name: TextView = itemView.findViewById(R.id.textContactName)
        val status: TextView = itemView.findViewById(R.id.textContactStatus)
        val checkBox: CheckBox = itemView.findViewById(R.id.checkSelected)
    }

    class DiffCallback : DiffUtil.ItemCallback<Contact>() {
        override fun areItemsTheSame(oldItem: Contact, newItem: Contact): Boolean {
            return (oldItem.contactId ?: oldItem._id ?: oldItem.userId) == (newItem.contactId ?: newItem._id ?: newItem.userId)
        }

        override fun areContentsTheSame(oldItem: Contact, newItem: Contact): Boolean = oldItem == newItem
    }
}
