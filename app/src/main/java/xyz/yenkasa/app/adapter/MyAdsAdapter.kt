package xyz.yenkasa.app.adapter

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
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

class MyAdsAdapter(
    private val rows: MutableList<Row>
) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    sealed class Row {
        data class Header(val title: String) : Row()
        data class Item(val ad: AdModel) : Row()
    }

    fun submit(nextRows: List<Row>) {
        rows.clear()
        rows.addAll(nextRows)
        notifyDataSetChanged()
    }

    override fun getItemViewType(position: Int): Int = when (rows[position]) {
        is Row.Header -> 0
        is Row.Item -> 1
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return if (viewType == 0) {
            HeaderHolder(inflater.inflate(R.layout.item_status_header, parent, false))
        } else {
            AdHolder(inflater.inflate(R.layout.item_ad_status, parent, false))
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val row = rows[position]) {
            is Row.Header -> (holder as HeaderHolder).bind(row)
            is Row.Item -> (holder as AdHolder).bind(row.ad)
        }
    }

    override fun getItemCount(): Int = rows.size

    private class HeaderHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val title: TextView = view.findViewById(R.id.textSectionTitle)
        fun bind(row: Row.Header) {
            title.text = row.title
        }
    }

    private class AdHolder(view: View) : RecyclerView.ViewHolder(view) {
        private val image: ImageView = view.findViewById(R.id.imagePreview)
        private val videoOverlay: ImageView = view.findViewById(R.id.imageVideoOverlay)
        private val title: TextView = view.findViewById(R.id.textTitle)
        private val subtitle: TextView = view.findViewById(R.id.textSubtitle)
        private val meta: TextView = view.findViewById(R.id.textMeta)
        private val status: TextView = view.findViewById(R.id.textStatus)
        private val mediaType: TextView = view.findViewById(R.id.textMediaType)
        private val rejection: TextView = view.findViewById(R.id.textRejection)

        fun bind(ad: AdModel) {
            title.text = ad.title ?: "Untitled ad"
            val isVideo = !ad.videoUrl.isNullOrBlank()
            subtitle.text = if (isVideo) "Video ad" else "Image ad"
            mediaType.text = if (isVideo) "VIDEO" else "IMAGE"
            videoOverlay.visibility = if (isVideo) View.VISIBLE else View.GONE
            meta.text = listOfNotNull(
                ad.submittedBy?.username?.takeIf { it.isNotBlank() }?.let { "by @$it" },
                formatRelative(ad.createdAt)
            ).joinToString(" • ").ifBlank {
                if (ad.sponsorName.isNullOrBlank()) "Awaiting review details" else ad.sponsorName
            }
            StatusUi.applyBadge(status, ad.approvalStatus ?: if (ad.isActive) "approved" else "pending")
            val previewUrl = ad.imageUrl ?: ad.thumbnailUrl
            if (!previewUrl.isNullOrBlank()) {
                image.visibility = View.VISIBLE
                Glide.with(itemView)
                    .load(previewUrl)
                    .placeholder(R.drawable.placeholder_image)
                    .into(image)
            } else {
                image.visibility = View.GONE
                videoOverlay.visibility = View.GONE
            }
            val reason = ad.rejectionReason?.trim().orEmpty()
            rejection.visibility = if (reason.isBlank()) View.GONE else View.VISIBLE
            rejection.text = if (reason.isBlank()) "" else "Reason: $reason"
        }

        private fun formatRelative(raw: String?): String {
            if (raw.isNullOrBlank()) return ""
            return runCatching {
                val parsed = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).parse(raw)
                    ?: return raw.take(10)
                val hours = ((Date().time - parsed.time) / (1000 * 60 * 60)).coerceAtLeast(0)
                when {
                    hours < 1 -> "now"
                    hours < 24 -> "${hours}h ago"
                    else -> "${hours / 24}d ago"
                }
            }.getOrDefault(raw.take(10))
        }
    }
}
