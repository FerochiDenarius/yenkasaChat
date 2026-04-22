package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community

class JoinedCommunityAdapter(
    private val communities: List<Community>,
    private val onCommunityClick: (Community) -> Unit
) : RecyclerView.Adapter<JoinedCommunityAdapter.JoinedCommunityViewHolder>() {

    inner class JoinedCommunityViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val imageIcon: android.widget.ImageView = itemView.findViewById(R.id.imageCommunityIcon)
        private val textName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val textMembers: TextView = itemView.findViewById(R.id.textMemberCount)
        private val textStatus: TextView = itemView.findViewById(R.id.textCommunityStatus)

        fun bind(community: Community) {
            textName.text = community.displayName ?: community.name ?: "Community"
            textMembers.text = "${community.memberCount} members"
            textStatus.text = if (community.isActive) "Active" else "Inactive"

            val imageUrl = community.icon?.takeIf { it.isNotBlank() }
                ?: community.coverImage?.takeIf { it.isNotBlank() }

            if (imageUrl == null) {
                Glide.with(itemView.context).clear(imageIcon)
                imageIcon.setImageResource(R.drawable.ic_community_placeholder)
            } else {
                Glide.with(itemView.context)
                    .load(imageUrl)
                    .apply(
                        RequestOptions()
                            .placeholder(R.drawable.ic_community_placeholder)
                            .error(R.drawable.ic_community_placeholder)
                            .centerCrop()
                    )
                    .into(imageIcon)
            }

            itemView.setOnClickListener { onCommunityClick(community) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): JoinedCommunityViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_joined_community, parent, false)
        return JoinedCommunityViewHolder(view)
    }

    override fun onBindViewHolder(holder: JoinedCommunityViewHolder, position: Int) {
        holder.bind(communities[position])
    }

    override fun getItemCount(): Int = communities.size
}
