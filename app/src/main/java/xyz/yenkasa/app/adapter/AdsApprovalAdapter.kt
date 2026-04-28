package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import com.bumptech.glide.Glide
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.AdModel
import xyz.yenkasa.app.util.StatusUi
import xyz.yenkasa.app.util.UserBadgeUtils

class AdsApprovalAdapter(
    private val items: MutableList<AdModel>,
    private val onApprove: (AdModel) -> Unit,
    private val onReject: (AdModel) -> Unit
) : RecyclerView.Adapter<AdsApprovalAdapter.ViewHolder>() {

    fun submit(nextItems: List<AdModel>) {
        items.clear()
        items.addAll(nextItems)
        notifyDataSetChanged()
    }

    fun removeAd(adId: String) {
        val index = items.indexOfFirst { it._id == adId }
        if (index >= 0) {
            items.removeAt(index)
            notifyItemRemoved(index)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_ad_approval, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(items[position], onApprove, onReject)
    }

    override fun getItemCount(): Int = items.size

    fun currentItems(): List<AdModel> = items.toList()

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val avatar: ImageView = view.findViewById(R.id.imageCreator)
        private val creatorName: TextView = view.findViewById(R.id.textCreatorName)
        private val creatorHandle: TextView = view.findViewById(R.id.textCreatorHandle)
        private val creatorTime: TextView = view.findViewById(R.id.textTime)
        private val image: ImageView = view.findViewById(R.id.imagePreview)
        private val title: TextView = view.findViewById(R.id.textTitle)
        private val status: TextView = view.findViewById(R.id.textStatus)
        private val creatorBadge: ImageView = view.findViewById(R.id.imageCreatorBadge)
        private val approveButton: Button = view.findViewById(R.id.btnApprove)
        private val rejectButton: Button = view.findViewById(R.id.btnReject)

        fun bind(ad: AdModel, onApprove: (AdModel) -> Unit, onReject: (AdModel) -> Unit) {
            creatorName.text = ad.submittedBy?.username ?: "Creator unavailable"
            creatorHandle.text = ad.submittedBy?.username?.let { "@${it.lowercase()}" } ?: "@unknown"
            creatorTime.text = formatRelative(ad.createdAt)
            title.text = ad.title ?: "Untitled ad"
            StatusUi.applyBadge(status, ad.approvalStatus ?: "pending")
            UserBadgeUtils.applyBadge(
                creatorBadge,
                ad.submittedBy?.verified == true,
                ad.submittedBy?.roleName ?: ad.submittedByRole
            )
            Glide.with(itemView)
                .load(ad.submittedBy?.profileImage)
                .placeholder(R.drawable.ic_profile_placeholder)
                .circleCrop()
                .into(avatar)
            val previewUrl = ad.imageUrl ?: ad.thumbnailUrl
            if (!previewUrl.isNullOrBlank()) {
                image.visibility = View.VISIBLE
                Glide.with(itemView)
                    .load(previewUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(image)
            } else {
                image.visibility = View.GONE
            }
            approveButton.setOnClickListener { onApprove(ad) }
            rejectButton.setOnClickListener { onReject(ad) }
        }

        private fun formatRelative(raw: String?): String {
            if (raw.isNullOrBlank()) return ""
            return runCatching {
                val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).parse(raw)
                    ?: return raw.take(10)
                val hours = ((Date().time - parsed.time) / (1000 * 60 * 60)).coerceAtLeast(0)
                when {
                    hours < 1 -> "Now"
                    hours < 24 -> "${hours}h ago"
                    else -> "${hours / 24}d ago"
                }
            }.getOrDefault(raw.take(10))
        }
    }
}
