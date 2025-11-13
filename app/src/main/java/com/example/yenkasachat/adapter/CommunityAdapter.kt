package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import com.example.yenkasachat.R
import com.example.yenkasachat.model.Community

class CommunityAdapter(
    private val communities: List<Community>,
    private val onCommunityClick: (Community) -> Unit
) : RecyclerView.Adapter<CommunityAdapter.CommunityViewHolder>() {

    // Optional callback for when user taps the "View" button
    var onCommunitySelected: ((Community) -> Unit)? = null

    inner class CommunityViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val communityIcon: ImageView = itemView.findViewById(R.id.imageCommunityIcon)
        private val communityName: TextView = itemView.findViewById(R.id.textCommunityName)
        private val communityLocation: TextView = itemView.findViewById(R.id.editCommunityLocation)
        private val memberCount: TextView = itemView.findViewById(R.id.textMemberCount)
        private val postCount: TextView = itemView.findViewById(R.id.textPostCount)
        private val categories: TextView = itemView.findViewById(R.id.editCategories)
        private val btnViewCommunity: Button = itemView.findViewById(R.id.btnViewCommunity)

        fun bind(community: Community) {
            // Basic info
            communityName.text = community.displayName
            communityLocation.text =
                if (community.location.isNullOrEmpty()) "Interest-based Community"
                else community.location

            memberCount.text = "${community.memberCount} members"
            postCount.text = "${community.postCount} posts"

            categories.text = if (community.categories.isNotEmpty())
                community.categories.joinToString(" • ")
            else "Uncategorized"

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

            // “View” button click → call secondary callback (dialog or join)
            btnViewCommunity.setOnClickListener {
                onCommunitySelected?.invoke(community)
            }
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
