package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.LiveActivityEvent
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class LiveActivityAdapter :
    ListAdapter<LiveActivityEvent, LiveActivityAdapter.LiveActivityViewHolder>(DiffCallback) {

    private var lastAnimatedPosition = -1

    init {
        setHasStableIds(true)
    }

    fun submitEvents(items: List<LiveActivityEvent>) {
        submitList(items.toList())
    }

    override fun getItemId(position: Int): Long = getItem(position).id.hashCode().toLong()

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): LiveActivityViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_live_activity_event, parent, false)
        return LiveActivityViewHolder(view)
    }

    override fun onBindViewHolder(holder: LiveActivityViewHolder, position: Int) {
        holder.bind(getItem(position))
        if (position > lastAnimatedPosition) {
            holder.itemView.alpha = 0f
            holder.itemView.translationY = 28f
            holder.itemView.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(260L)
                .setInterpolator(AccelerateDecelerateInterpolator())
                .start()
            lastAnimatedPosition = position
        } else {
            holder.itemView.alpha = 1f
            holder.itemView.translationY = 0f
        }
    }

    class LiveActivityViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val avatarView: ImageView = itemView.findViewById(R.id.imageLiveEventAvatar)
        private val textView: TextView = itemView.findViewById(R.id.textLiveEventText)
        private val timeView: TextView = itemView.findViewById(R.id.textLiveEventTime)
        private val parserWithMillis = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        private val parserWithoutMillis = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
        private val timeFormatter = SimpleDateFormat("h:mm a", Locale.getDefault())

        fun bind(event: LiveActivityEvent) {
            textView.text = event.text
            timeView.text = formatEventTime(event.createdAt)

            Glide.with(itemView)
                .load(event.profileImage)
                .placeholder(R.drawable.ic_default_profile)
                .error(R.drawable.ic_default_profile)
                .into(avatarView)
        }

        private fun formatEventTime(value: String?): String {
            if (value.isNullOrBlank()) return "Just now"

            val parsedDate = runCatching { parserWithMillis.parse(value) }
                .getOrNull()
                ?: runCatching { parserWithoutMillis.parse(value) }.getOrNull()

            return parsedDate?.let { date ->
                runCatching { timeFormatter.format(date) }.getOrDefault("Just now")
            } ?: "Just now"
        }
    }

    private object DiffCallback : DiffUtil.ItemCallback<LiveActivityEvent>() {
        override fun areItemsTheSame(
            oldItem: LiveActivityEvent,
            newItem: LiveActivityEvent
        ): Boolean = oldItem.id == newItem.id

        override fun areContentsTheSame(
            oldItem: LiveActivityEvent,
            newItem: LiveActivityEvent
        ): Boolean = oldItem == newItem
    }
}
