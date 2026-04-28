package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.util.StatusUi
import xyz.yenkasa.app.util.UserBadgeUtils

class CommunityApprovalAdapter(
    private val items: MutableList<Community>,
    private val onApprove: (Community) -> Unit,
    private val onReject: (Community) -> Unit
) : RecyclerView.Adapter<CommunityApprovalAdapter.ViewHolder>() {

    fun submit(nextItems: List<Community>) {
        items.clear()
        items.addAll(nextItems)
        notifyDataSetChanged()
    }

    fun removeCommunity(communityId: String) {
        val index = items.indexOfFirst { it.id == communityId }
        if (index >= 0) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_approval, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position], onApprove, onReject)
    }

    override fun getItemCount(): Int = items.size

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val avatar: ImageView = view.findViewById(R.id.imageCreator)
        private val name: TextView = view.findViewById(R.id.textCreatorName)
        private val handle: TextView = view.findViewById(R.id.textCreatorHandle)
        private val creatorBadge: ImageView = view.findViewById(R.id.imageCreatorBadge)
        private val newBadge: TextView = view.findViewById(R.id.textNewBadge)
        private val title: TextView = view.findViewById(R.id.textCommunityTitle)
        private val description: TextView = view.findViewById(R.id.textCommunityDescription)
        private val approveButton: Button = view.findViewById(R.id.btnApprove)
        private val rejectButton: Button = view.findViewById(R.id.btnReject)

        fun bind(item: Community, onApprove: (Community) -> Unit, onReject: (Community) -> Unit) {
            val creator = item.creator
            name.text = creator?.username ?: "Pending creator"
            handle.text = creator?.username?.let { "@${it.lowercase()}" } ?: "@unknown"
            UserBadgeUtils.applyBadge(creatorBadge, creator?.verified == true, creator?.roleName)
            title.text = item.displayName ?: item.name ?: "Community"
            description.text = item.description?.ifBlank { "A new community request is waiting for review." }
                ?: "A new community request is waiting for review."
            StatusUi.applyBadge(newBadge, "pending")
            Glide.with(itemView)
                .load(creator?.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(avatar)
            approveButton.setOnClickListener { onApprove(item) }
            rejectButton.setOnClickListener { onReject(item) }
        }
    }
}
