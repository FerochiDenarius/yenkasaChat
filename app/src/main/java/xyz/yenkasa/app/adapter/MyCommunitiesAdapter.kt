package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community
import xyz.yenkasa.app.util.StatusUi

class MyCommunitiesAdapter(
    private val items: MutableList<Community>
) : RecyclerView.Adapter<MyCommunitiesAdapter.ViewHolder>() {

    fun submit(nextItems: List<Community>) {
        items.clear()
        items.addAll(nextItems)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_community_status, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position])
    }

    override fun getItemCount(): Int = items.size

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val title: TextView = view.findViewById(R.id.textTitle)
        private val description: TextView = view.findViewById(R.id.textDescription)
        private val meta: TextView = view.findViewById(R.id.textMeta)
        private val status: TextView = view.findViewById(R.id.textStatus)
        private val statusNote: TextView = view.findViewById(R.id.textStatusNote)

        fun bind(item: Community) {
            title.text = item.displayName ?: item.name ?: "Community"
            description.text = item.description?.takeIf { it.isNotBlank() } ?: "No description"
            meta.text = listOfNotNull(
                item.communityLevel?.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() },
                item.country,
                item.state,
                item.city
            ).joinToString(" • ").ifBlank { "Community request submitted" }
            val statusValue = when {
                !item.isActive -> "rejected"
                item.isApproved -> "approved"
                else -> "pending"
            }
            StatusUi.applyBadge(status, statusValue)
            statusNote.text = when (statusValue) {
                "approved" -> "Visible in the app and ready for members."
                "rejected" -> "This request is inactive until you submit a new one."
                else -> "Waiting for moderator or developer review."
            }
        }
    }
}
