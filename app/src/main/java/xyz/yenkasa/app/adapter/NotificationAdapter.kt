package xyz.yenkasa.app.adapter

import android.content.Context
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.NotificationModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class NotificationAdapter(
    private var items: MutableList<NotificationModel>,
    private val onItemClick: (NotificationModel) -> Unit,
    private val onSwipeDelete: (NotificationModel) -> Unit
) : RecyclerView.Adapter<NotificationAdapter.ViewHolder>() {

    val itemsList: List<NotificationModel>
        get() = items

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val title: TextView = view.findViewById(R.id.txtNotificationTitle)
        val subtitle: TextView = view.findViewById(R.id.txtNotificationSubtitle)
        val time: TextView = view.findViewById(R.id.txtNotificationTime)
        val unreadDot: ImageView = view.findViewById(R.id.imgUnreadIndicator)
        val icon: ImageView = view.findViewById(R.id.imgNotificationIcon)
        val iconContainer: FrameLayout = view.findViewById(R.id.iconContainer)
        val rewardBadge: TextView = view.findViewById(R.id.txtRewardBadge)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_notification, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: ViewHolder, pos: Int) {
        val item = items[pos]
        val content = buildNotificationContent(holder.itemView.context, item)

        holder.title.text = content.title
        holder.title.setTypeface(null, Typeface.BOLD)
        holder.subtitle.text = content.subtitle
        holder.time.text = formatRelativeTime(holder.itemView.context, item.createdAt)
        holder.unreadDot.visibility = if (item.status == "unread") View.VISIBLE else View.INVISIBLE

        holder.icon.setImageResource(getNotificationIcon(item.type))
        holder.iconContainer.background = roundedIconBackground(holder, getNotificationColor(item.type))

        if (content.rewardBadge == null) {
            holder.rewardBadge.visibility = View.GONE
        } else {
            holder.rewardBadge.visibility = View.VISIBLE
            holder.rewardBadge.text = content.rewardBadge
        }

        holder.itemView.setOnClickListener {
            holder.itemView.animate()
                .scaleX(0.97f)
                .scaleY(0.97f)
                .setDuration(70)
                .withEndAction {
                    holder.itemView.animate()
                        .scaleX(1f)
                        .scaleY(1f)
                        .setDuration(90)
                        .withEndAction { onItemClick(item) }
                        .start()
                }
                .start()
        }
    }

    fun markItemAsRead(id: String) {
        val index = items.indexOfFirst { it.id == id }
        if (index != -1) {
            val updated = items[index].copy(status = "read")
            items[index] = updated
            notifyItemChanged(index)
        }
    }

    fun removeInstant(id: String) {
        val index = items.indexOfFirst { it.id == id }
        if (index != -1) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    fun updateList(newList: List<NotificationModel>) {
        val diffCallback = NotificationDiff(items, newList)
        val diffResult = DiffUtil.calculateDiff(diffCallback)

        items.clear()
        items.addAll(newList)
        diffResult.dispatchUpdatesTo(this)
    }

    fun removeById(id: String) {
        val index = items.indexOfFirst { it.id == id }
        if (index >= 0) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    fun removeAt(position: Int) {
        if (position in items.indices) {
            val item = items[position]
            items.removeAt(position)
            notifyItemRemoved(position)
            onSwipeDelete(item)
        }
    }

    fun getNotificationIcon(type: String): Int {
        return when (type.lowercase()) {
            "reward_post_view", "reward_post_view_received", "post_view", "view_milestone" -> R.drawable.ic_eye
            "reward_post", "video" -> R.drawable.ic_play_arrow
            "image", "reward_image" -> R.drawable.ic_image
            "comment", "post_comment", "comment_reply", "comment_like", "reward_comment" -> R.drawable.ic_comment
            "like", "post_liked", "post_like", "reward_post_like", "reward_comment_like" -> R.drawable.ic_heart_filled
            "community_post" -> R.drawable.ic_communities
            "post_approved" -> R.drawable.ic_check_circle
            "follow", "new_follower" -> R.drawable.ic_person_add
            else -> R.drawable.ic_bell
        }
    }

    fun getNotificationColor(type: String): Int {
        return when (type.lowercase()) {
            "reward_image", "image" -> R.color.notification_image_bg
            "reward_post_view", "reward_post_view_received", "post_view", "view_milestone" -> R.color.notification_view_bg
            "comment", "post_comment", "comment_reply", "comment_like", "reward_comment" -> R.color.notification_comment_bg
            "like", "post_liked", "post_like", "reward_post_like", "reward_comment_like" -> R.color.notification_like_bg
            "community_post" -> R.color.notification_view_bg
            else -> R.color.notification_video_bg
        }
    }

    private fun buildNotificationContent(context: Context, n: NotificationModel): NotificationContent {
        val rawMessage = n.message?.trim().orEmpty()
        val fallbackTitle = formatMessage(context, n)
        val rewardAmount = extractRewardAmount(rawMessage)
        val isReward = isRewardNotification(n) || rewardAmount != null

        if (!isReward) {
            return NotificationContent(
                title = rawMessage.ifBlank { fallbackTitle },
                subtitle = subtitleForType(context, n),
                rewardBadge = null
            )
        }

        val parts = rawMessage
            .split(". ")
            .map { it.trim().trimEnd('.') }
            .filter { it.isNotBlank() }

        val title = parts.firstOrNull()
            ?.replaceFirst("^Earned".toRegex(), context.getString(R.string.notification_you_earned_prefix))
            ?: fallbackTitle
        val subtitle = parts.getOrNull(1)
            ?: rewardAmount?.let { context.getString(R.string.reward_added_to_wallet, it) }
            ?: context.getString(R.string.ykc_added_to_wallet)

        return NotificationContent(
            title = title,
            subtitle = subtitle,
            rewardBadge = rewardAmount
        )
    }

    private fun formatMessage(context: Context, n: NotificationModel): String {
        return when (n.type.lowercase()) {
            "like", "post_liked", "post_like" -> context.getString(R.string.notification_someone_liked_post)
            "comment", "post_comment" -> context.getString(R.string.notification_someone_commented_post)
            "comment_reply" -> context.getString(R.string.notification_someone_replied_comment)
            "follow", "new_follower" -> context.getString(R.string.notification_new_follower)
            "post_approved" -> context.getString(R.string.notification_post_approved)
            "view_milestone" -> context.getString(R.string.notification_view_milestone)
            "community_post" -> n.message?.takeIf { it.isNotBlank() }
                ?: context.getString(R.string.notification_community_post)
            else -> n.message ?: n.type
        }
    }

    private fun subtitleForType(context: Context, n: NotificationModel): String {
        return when (n.type.lowercase()) {
            "follow", "new_follower" -> context.getString(R.string.tap_to_view_profile)
            "post_comment", "comment", "comment_reply" -> context.getString(R.string.tap_to_open_conversation)
            "post_like", "post_liked", "like" -> context.getString(R.string.tap_to_view_post)
            "community_post" -> context.getString(R.string.tap_to_view_post)
            "ad_approved", "ad_rejected" -> context.getString(R.string.tap_to_view_ads)
            "community_approved", "community_rejected" -> context.getString(R.string.tap_to_view_communities)
            else -> context.getString(R.string.tap_to_view_activity)
        }
    }

    private fun formatRelativeTime(context: Context, iso: String?): String {
        if (iso == null) return context.getString(R.string.just_now)
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(iso) ?: return context.getString(R.string.just_now)
            val diff = Date().time - date.time
            when {
                diff < 60000 -> context.getString(R.string.just_now)
                diff < 3600000 -> context.getString(R.string.minutes_ago, diff / 60000)
                diff < 86400000 -> context.getString(R.string.hours_ago, diff / 3600000)
                else -> context.getString(R.string.days_ago, diff / 86400000)
            }
        } catch (e: Exception) {
            context.getString(R.string.just_now)
        }
    }

    private fun roundedIconBackground(holder: ViewHolder, colorRes: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = holder.itemView.resources.displayMetrics.density * 14f
            setColor(ContextCompat.getColor(holder.itemView.context, colorRes))
        }
    }

    private fun extractRewardAmount(message: String): String? {
        val match = Regex("""\+?(\d+(?:\.\d+)?)\s*YKC""", RegexOption.IGNORE_CASE)
            .find(message)
            ?: Regex("""earned\s+(\d+(?:\.\d+)?)""", RegexOption.IGNORE_CASE).find(message)

        val amount = match?.groupValues?.getOrNull(1)?.takeIf { it.isNotBlank() } ?: return null
        return "+$amount YKC"
    }

    private fun isRewardNotification(n: NotificationModel): Boolean {
        val type = n.type.lowercase()
        return type == "reward" || type.startsWith("reward_") || n.targetType?.lowercase() == "wallet"
    }

    class NotificationDiff(
        private val oldList: List<NotificationModel>,
        private val newList: List<NotificationModel>
    ) : DiffUtil.Callback() {
        override fun getOldListSize() = oldList.size
        override fun getNewListSize() = newList.size
        override fun areItemsTheSame(old: Int, new: Int) =
            oldList[old].id == newList[new].id

        override fun areContentsTheSame(old: Int, new: Int) =
            oldList[old] == newList[new]
    }

    fun attachSwipeToRecyclerView(rv: RecyclerView) {
        val swipe = object : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT) {
            override fun onMove(rv: RecyclerView, vh: RecyclerView.ViewHolder, target: RecyclerView.ViewHolder) = false

            override fun onSwiped(vh: RecyclerView.ViewHolder, direction: Int) {
                val position = vh.bindingAdapterPosition
                if (position == RecyclerView.NO_POSITION) {
                    notifyDataSetChanged()
                    return
                }

                removeAt(position)
            }
        }
        ItemTouchHelper(swipe).attachToRecyclerView(rv)
    }

    private data class NotificationContent(
        val title: String,
        val subtitle: String,
        val rewardBadge: String?
    )
}
