package xyz.yenkasa.app.adapter

import android.graphics.drawable.Drawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LiveLeaderboardEntry
import xyz.yenkasa.app.model.LiveLeaderboardSection

class LiveMetricCardAdapter(
    private val onActionClick: (LiveLeaderboardSection) -> Unit
) : ListAdapter<LiveLeaderboardSection, LiveMetricCardAdapter.LiveCardViewHolder>(DiffCallback) {

    init {
        setHasStableIds(true)
    }

    fun submitSections(items: List<LiveLeaderboardSection>) {
        submitList(items.toList())
    }

    override fun getItemId(position: Int): Long {
        val item = getItem(position)
        return (item.metricKey.ifBlank { item.title }).hashCode().toLong()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LiveCardViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_live_metric_card, parent, false)
        return LiveCardViewHolder(view, onActionClick)
    }

    override fun onBindViewHolder(holder: LiveCardViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    class LiveCardViewHolder(
        itemView: View,
        private val onActionClick: (LiveLeaderboardSection) -> Unit
    ) : RecyclerView.ViewHolder(itemView) {

        private val titleView: TextView = itemView.findViewById(R.id.textLiveCardTitle)
        private val badgeView: TextView = itemView.findViewById(R.id.textLiveCardBadge)
        private val leadersContainer: LinearLayout = itemView.findViewById(R.id.layoutLiveLeaders)
        private val currentHintView: TextView = itemView.findViewById(R.id.textLiveCurrentHint)
        private val actionButton: TextView = itemView.findViewById(R.id.buttonLiveAction)

        fun bind(section: LiveLeaderboardSection) {
            titleView.text = section.title
            badgeView.text = if (section.metricKey == "ykc") "YKC" else "Live"
            leadersContainer.removeAllViews()

            val inflater = LayoutInflater.from(itemView.context)
            section.leaders.take(3).forEachIndexed { index, leader ->
                val row = inflater.inflate(R.layout.item_live_metric_user_row, leadersContainer, false)
                bindLeaderRow(row, leader, index)
                leadersContainer.addView(row)
            }

            val currentUser = section.currentUser
            currentHintView.text = when {
                currentUser == null -> "Keep going to enter the top 3."
                currentUser.rank <= 0 -> currentUser.progressHint ?: "Start now to climb."
                currentUser.isCurrentUser -> "You are #${currentUser.rank}. ${currentUser.progressHint.orEmpty()}".trim()
                else -> currentUser.progressHint ?: ""
            }

            actionButton.text = when (section.action) {
                "comment" -> "Go Comment"
                "view" -> "Go View"
                "follow" -> "Go Follow"
                "like" -> "Go Earn"
                else -> "Open Feed"
            }
            actionButton.setOnClickListener { onActionClick(section) }

            if (section.highlightCurrentUser) {
                itemView.animate().cancel()
                itemView.scaleX = 1f
                itemView.scaleY = 1f
                itemView.alpha = 1f
                itemView.animate()
                    .scaleX(1.02f)
                    .scaleY(1.02f)
                    .alpha(1f)
                    .setDuration(180L)
                    .withEndAction {
                        itemView.animate()
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(220L)
                            .start()
                    }
                    .start()
            } else {
                itemView.animate().cancel()
                itemView.scaleX = 1f
                itemView.scaleY = 1f
                itemView.alpha = 1f
            }
        }

        private fun bindLeaderRow(view: View, leader: LiveLeaderboardEntry, index: Int) {
            val rankView = view.findViewById<TextView>(R.id.textLiveRank)
            val avatarView = view.findViewById<ImageView>(R.id.imageLiveAvatar)
            val usernameView = view.findViewById<TextView>(R.id.textLiveUsername)
            val youView = view.findViewById<TextView>(R.id.textLiveYou)
            val hintView = view.findViewById<TextView>(R.id.textLiveProgressHint)
            val countView = view.findViewById<TextView>(R.id.textLiveCount)

            rankView.text = "${leader.rank.takeIf { it > 0 } ?: (index + 1)}"
            rankView.background = rankBackground(index)
            usernameView.text = leader.username.ifBlank { "Yenkasa user" }
            youView.visibility = if (leader.isCurrentUser) View.VISIBLE else View.GONE
            hintView.text = leader.progressHint.orEmpty()
            countView.text = leader.count.toString()

            Glide.with(view)
                .load(leader.profileImage)
                .placeholder(R.drawable.ic_default_profile)
                .error(R.drawable.ic_default_profile)
                .into(avatarView)

            if (leader.isCurrentUser) {
                view.animate().cancel()
                view.alpha = 1f
                view.animate()
                    .alpha(0.86f)
                    .setDuration(220L)
                    .withEndAction {
                        view.animate().alpha(1f).setDuration(260L).start()
                    }
                    .start()
            } else {
                view.animate().cancel()
                view.alpha = 1f
            }
        }

        private fun rankBackground(index: Int): Drawable? {
            val drawableRes = when (index) {
                0 -> R.drawable.bg_live_rank_circle_gold
                1 -> R.drawable.bg_live_rank_circle_silver
                else -> R.drawable.bg_live_rank_circle_bronze
            }
            return ContextCompat.getDrawable(itemView.context, drawableRes)
        }
    }

    private object DiffCallback : DiffUtil.ItemCallback<LiveLeaderboardSection>() {
        override fun areItemsTheSame(
            oldItem: LiveLeaderboardSection,
            newItem: LiveLeaderboardSection
        ): Boolean {
            return (oldItem.metricKey.ifBlank { oldItem.title }) ==
                (newItem.metricKey.ifBlank { newItem.title })
        }

        override fun areContentsTheSame(
            oldItem: LiveLeaderboardSection,
            newItem: LiveLeaderboardSection
        ): Boolean = oldItem == newItem
    }
}
