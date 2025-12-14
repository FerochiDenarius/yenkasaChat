package xyz.yenkasa.app.adapter

import android.graphics.Color
import android.view.*
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.NotificationModel
import java.text.SimpleDateFormat
import java.util.*

class NotificationAdapter(
    private var items: MutableList<NotificationModel>,
    private val onItemClick: (NotificationModel) -> Unit,
    private val onSwipeDelete: (NotificationModel) -> Unit
) : RecyclerView.Adapter<NotificationAdapter.ViewHolder>() {

    val itemsList: List<NotificationModel>
        get() = items

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val msg: TextView = view.findViewById(R.id.txtNotificationMessage)
        val time: TextView = view.findViewById(R.id.txtNotificationTime)
        val unreadDot: ImageView = view.findViewById(R.id.imgUnreadIndicator)
        val icon: ImageView = view.findViewById(R.id.imgNotificationIcon)
        val container: View = view
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_notification, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: ViewHolder, pos: Int) {
        val item = items[pos]

        holder.msg.text = formatMessage(item)
        holder.time.text = formatRelativeTime(item.createdAt)

        // unread highlight
        val unread = item.status == "unread"
        holder.unreadDot.visibility = if (unread) View.VISIBLE else View.INVISIBLE
        holder.container.setBackgroundColor(
            if (unread) Color.parseColor("#EFEFEF") else Color.TRANSPARENT
        )

        holder.icon.setImageResource(getIconForType(item.type))

        holder.itemView.setOnClickListener { onItemClick(item) }
    }

    // ---------- NEW ----------
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
    // --------------------------

    private fun formatMessage(n: NotificationModel): String {
        return when (n.type.lowercase()) {
            "like", "post_liked" -> "Someone liked your post"
            "comment" -> "Someone commented on your post"
            "follow" -> "New follower"
            "post_approved" -> "Your post was approved"
            else -> n.message ?: n.type
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

    private fun formatRelativeTime(iso: String?): String {
        if (iso == null) return "Just now"
        return try {
            val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            parser.timeZone = TimeZone.getTimeZone("UTC")
            val date = parser.parse(iso) ?: return "Just now"
            val diff = Date().time - date.time
            when {
                diff < 60000 -> "Just now"
                diff < 3600000 -> "${diff / 60000}m ago"
                diff < 86400000 -> "${diff / 3600000}h ago"
                else -> "${diff / 86400000}d ago"
            }
        } catch (e: Exception) {
            "Just now"
        }
    }

    private fun getIconForType(type: String): Int {
        return when (type.lowercase()) {
            "comment" -> R.drawable.ic_comment
            "like", "post_liked" -> R.drawable.ic_like
            "post_approved" -> R.drawable.ic_check_circle
            "follow" -> R.drawable.ic_person_add
            else -> R.drawable.ic_bell
        }
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
                removeAt(vh.adapterPosition)
            }
        }
        ItemTouchHelper(swipe).attachToRecyclerView(rv)
    }
}
