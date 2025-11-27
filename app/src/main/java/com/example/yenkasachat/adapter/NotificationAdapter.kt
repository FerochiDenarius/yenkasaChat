package com.example.yenkasachat.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.example.yenkasachat.R
import com.example.yenkasachat.model.NotificationModel

class NotificationAdapter(
    private val items: MutableList<NotificationModel>,
    private val onItemClick: (NotificationModel) -> Unit
) : RecyclerView.Adapter<NotificationAdapter.ViewHolder>() {

    inner class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val msg: TextView = view.findViewById(R.id.txtNotificationMessage)
        val time: TextView = view.findViewById(R.id.txtNotificationTime)
        val unreadDot: ImageView = view.findViewById(R.id.imgUnreadIndicator)
        val icon: ImageView = view.findViewById(R.id.imgNotificationIcon)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val v = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_notification, parent, false)
        return ViewHolder(v)
    }

    override fun getItemCount() = items.size

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = items[position]

        holder.msg.text = item.message ?: item.type
        holder.time.text = formatTime(item.createdAt)

        holder.unreadDot.visibility =
            if (item.status == "unread") View.VISIBLE else View.INVISIBLE

        holder.itemView.setOnClickListener {
            onItemClick(item)
        }
    }

    fun update(newList: List<NotificationModel>) {
        items.clear()
        items.addAll(newList)
        notifyDataSetChanged()
    }

    private fun formatTime(timestamp: String?): String {
        return timestamp
            ?.replace("T", " ")
            ?.replace("Z", "")
            ?: "Just now"
    }

}
