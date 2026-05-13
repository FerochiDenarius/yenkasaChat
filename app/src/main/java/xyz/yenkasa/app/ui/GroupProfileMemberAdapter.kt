package xyz.yenkasa.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Participant

class GroupProfileMemberAdapter :
    ListAdapter<Participant, GroupProfileMemberAdapter.ViewHolder>(DiffCallback()) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_group_profile_member, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val participant = getItem(position)
        holder.name.text = participant.username ?: "Yenkasa user"
        holder.status.text = if (participant.resolvedOnline) "Online" else "Group member"

        Glide.with(holder.itemView.context)
            .load(participant.displayImage.orEmpty())
            .placeholder(R.drawable.ic_profile_placeholder)
            .error(R.drawable.ic_profile_placeholder)
            .circleCrop()
            .into(holder.avatar)
    }

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        val avatar: ImageView = itemView.findViewById(R.id.imageMemberAvatar)
        val name: TextView = itemView.findViewById(R.id.textMemberName)
        val status: TextView = itemView.findViewById(R.id.textMemberStatus)
    }

    class DiffCallback : DiffUtil.ItemCallback<Participant>() {
        override fun areItemsTheSame(oldItem: Participant, newItem: Participant): Boolean {
            return oldItem._id == newItem._id
        }

        override fun areContentsTheSame(oldItem: Participant, newItem: Participant): Boolean {
            return oldItem == newItem
        }
    }
}
