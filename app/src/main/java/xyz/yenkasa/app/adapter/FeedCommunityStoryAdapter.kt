package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import com.bumptech.glide.request.RequestOptions
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community

class FeedCommunityStoryAdapter(
    private val onAllCommunitiesClick: () -> Unit,
    private val onCommunityClick: (Community) -> Unit
) : RecyclerView.Adapter<FeedCommunityStoryAdapter.StoryViewHolder>() {

    private var communities: List<Community> = emptyList()
    private var selectedIds: Set<String> = emptySet()
    private var latestMediaByCommunityId: Map<String, String> = emptyMap()

    fun submitCommunities(
        nextCommunities: List<Community>,
        nextSelectedIds: Set<String>,
        nextLatestMediaByCommunityId: Map<String, String> = emptyMap()
    ) {
        communities = nextCommunities
        selectedIds = nextSelectedIds
        latestMediaByCommunityId = nextLatestMediaByCommunityId
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): StoryViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_feed_community_story, parent, false)
        return StoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: StoryViewHolder, position: Int) {
        if (position == 0) {
            holder.bindAll(isAllSelected())
        } else {
            holder.bindCommunity(communities[position - 1], selectedIds)
        }
    }

    override fun getItemCount(): Int = communities.size + 1

    private fun isAllSelected(): Boolean {
        val allIds = communities.mapNotNull { it.id }.toSet()
        return allIds.isNotEmpty() && selectedIds.containsAll(allIds)
    }

    inner class StoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val storyRoot: View = itemView.findViewById(R.id.storyRoot)
        private val imageFrame: FrameLayout = itemView.findViewById(R.id.storyImageFrame)
        private val communityImage: ImageView = itemView.findViewById(R.id.imageCommunityStory)
        private val allIcon: ImageView = itemView.findViewById(R.id.imageAllCommunitiesIcon)
        private val name: TextView = itemView.findViewById(R.id.textCommunityStoryName)

        fun bindAll(selected: Boolean) {
            storyRoot.setBackgroundResource(
                if (selected) R.drawable.bg_feed_story_tile_selected else R.drawable.bg_feed_story_tile
            )
            imageFrame.setBackgroundResource(R.drawable.bg_feed_story_tile_plain)
            communityImage.visibility = View.GONE
            allIcon.visibility = View.VISIBLE
            name.text = "All Communities"
            name.setTextColor(ContextCompat.getColor(itemView.context, R.color.feed_primary_text))
            itemView.setOnClickListener { onAllCommunitiesClick() }
        }

        fun bindCommunity(community: Community, selectedIds: Set<String>) {
            val selected = community.id != null && selectedIds.contains(community.id)
            storyRoot.setBackgroundResource(
                if (selected) R.drawable.bg_feed_story_tile_selected else R.drawable.bg_feed_story_tile_plain
            )
            imageFrame.setBackgroundResource(R.drawable.bg_feed_avatar_ring)
            communityImage.visibility = View.VISIBLE
            allIcon.visibility = View.GONE
            name.text = community.displayName ?: community.name ?: "Community"
            name.setTextColor(ContextCompat.getColor(itemView.context, R.color.feed_primary_text))

            val imageUrl = when {
                community.id != null && !latestMediaByCommunityId[community.id].isNullOrBlank() ->
                    latestMediaByCommunityId[community.id]
                !community.icon.isNullOrBlank() -> community.icon
                !community.coverImage.isNullOrBlank() -> community.coverImage
                else -> null
            }

            if (imageUrl.isNullOrBlank()) {
                Glide.with(itemView.context).clear(communityImage)
                communityImage.setImageResource(R.drawable.ic_community_placeholder)
            } else {
                Glide.with(itemView.context)
                    .load(imageUrl)
                    .apply(
                        RequestOptions()
                            .placeholder(R.drawable.ic_community_placeholder)
                            .error(R.drawable.ic_community_placeholder)
                            .circleCrop()
                    )
                    .into(communityImage)
            }

            itemView.setOnClickListener { onCommunityClick(community) }
        }
    }
}
