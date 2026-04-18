package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community

class CommunityAdapter(
    private val communities: List<Community>,
    private val onCommunityClick: (Community) -> Unit
) : RecyclerView.Adapter<CommunityAdapter.CommunityViewHolder>() {

    // Optional callback for when user taps the "View" button
    var onCommunitySelected: ((Community) -> Unit)? = null
    // Separate callbacks for different actions
    var onJoinCommunity: ((Community) -> Unit)? = null
    var onViewCommunity: ((Community) -> Unit)? = null
    var onLeaveCommunity: ((Community) -> Unit)? = null // NEW: Leave callback
    var isCommunityJoined: ((Community) -> Boolean)? = null


    inner class CommunityViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val communityIcon: ImageView = itemView.findViewById(R.id.imageCommunityIcon)
        private val communityName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val communityLocation: TextView = itemView.findViewById(R.id.textCommunityLocation)
        private val memberCount: TextView = itemView.findViewById(R.id.textMemberCount)
        private val postCount: TextView = itemView.findViewById(R.id.textPostCount)
        private val categories: TextView = itemView.findViewById(R.id.editCategories)
        private val btnViewCommunity: Button = itemView.findViewById(R.id.btnViewCommunity)
        private val btnJoinCommunity: Button = itemView.findViewById(R.id.btnJoinCommunity)
        private val btnLeaveCommunity: Button = itemView.findViewById(R.id.btnLeaveCommunity) // NEW: Leave button


        fun bind(community: Community) {
            // Basic info
            communityName.text = community.displayName ?: community.name ?: "Unnamed Community"
            communityLocation.text =
                if (community.location.isNullOrEmpty()) "Interest-based Community"
                else community.location

            memberCount.text = "${community.memberCount} members"
            postCount.text = "${community.postCount} posts"

            categories.text = if (community.categories.isNotEmpty())
                community.categories.joinToString(" • ")
            else "Uncategorized"

            val isJoined = isCommunityJoined?.invoke(community) ?: community.isUserMember()

            btnLeaveCommunity.visibility = if (isJoined) View.VISIBLE else View.GONE
            btnJoinCommunity.visibility = if (isJoined) View.GONE else View.VISIBLE
            btnViewCommunity.visibility = View.VISIBLE

            btnJoinCommunity.setOnClickListener {
                onJoinCommunity?.invoke(community)
            }

            btnLeaveCommunity.setOnClickListener {
                onLeaveCommunity?.invoke(community)
            }

            btnViewCommunity.setOnClickListener {
                onViewCommunity?.invoke(community)
                    ?: onCommunitySelected?.invoke(community)
                    ?: onCommunityClick(community)
            }

            // Load image safely
            val imageUrl = when {
                !community.icon.isNullOrEmpty() -> community.icon
                !community.coverImage.isNullOrEmpty() -> community.coverImage
                else -> null
            }

            Glide.with(itemView.context)
                .load(imageUrl)
                .apply(
                    RequestOptions()
                        .placeholder(R.drawable.ic_community_placeholder)
                        .error(R.drawable.ic_community_placeholder)
                        .circleCrop()
                )
                .into(communityIcon)

            // Entire item click → open community feed
            itemView.setOnClickListener { onCommunityClick(community) }

        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): CommunityViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_card, parent, false)
        return CommunityViewHolder(view)
    }

    override fun onBindViewHolder(holder: CommunityViewHolder, position: Int) {
        holder.bind(communities[position])
    }

    override fun getItemCount(): Int = communities.size
}
