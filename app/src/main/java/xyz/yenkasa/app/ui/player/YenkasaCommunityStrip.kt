package xyz.yenkasa.app.ui.player

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community

class YenkasaCommunityStrip @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : HorizontalScrollView(context, attrs) {

    private val container = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
    }

    init {
        isHorizontalScrollBarEnabled = false
        overScrollMode = OVER_SCROLL_NEVER
        addView(
            container,
            LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)
        )
    }

    fun submit(
        communities: List<Community>,
        selectedIds: Set<String>,
        onAllSelected: () -> Unit,
        onCommunitySelected: (Community) -> Unit
    ) {
        container.removeAllViews()
        container.addView(buildCard("All", null, selectedIds.isEmpty(), onAllSelected))
        communities.forEach { community ->
            val name = community.displayName ?: community.name ?: "Community"
            container.addView(
                buildCard(
                    name,
                    community.coverImage ?: community.icon,
                    selectedIds.contains(community.id),
                    onClick = { onCommunitySelected(community) }
                )
            )
        }
    }

    private fun buildCard(
        title: String,
        imageUrl: String?,
        selected: Boolean,
        onClick: () -> Unit
    ): LinearLayout {
        val card = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor(if (selected) "#262E2A" else "#1A1D1C"))
                setStroke(dp(1), Color.parseColor(if (selected) "#37E37B" else "#2F3633"))
            }
            setPadding(dp(8), dp(8), dp(8), dp(8))
            layoutParams = LinearLayout.LayoutParams(dp(92), LayoutParams.WRAP_CONTENT).apply {
                marginEnd = dp(8)
            }
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }

        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            layoutParams = LinearLayout.LayoutParams(dp(76), dp(76))
            background = GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor("#111111"))
            }
            clipToOutline = true
            setImageResource(R.drawable.ic_logo_emblem)
        }
        if (!imageUrl.isNullOrBlank()) {
            Glide.with(context)
                .load(imageUrl)
                .placeholder(R.drawable.ic_logo_emblem)
                .into(image)
        }

        val label = TextView(context).apply {
            text = title
            textSize = 11f
            setTextColor(Color.WHITE)
            maxLines = 1
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(6)
            }
        }

        card.addView(image)
        card.addView(label)
        return card
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
