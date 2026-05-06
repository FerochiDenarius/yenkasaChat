package xyz.yenkasa.app.ui.player

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.bumptech.glide.Glide
import xyz.yenkasa.app.R
import xyz.yenkasa.app.model.Community

class YenkasaCommunityStrip @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : ScrollView(context, attrs) {

    private val container = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
    }

    init {
        isVerticalScrollBarEnabled = false
        overScrollMode = OVER_SCROLL_NEVER
        addView(
            container,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT)
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
    ): View {
        val card = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
                setColor(Color.parseColor(if (selected) "#D91A7D43" else "#B8101112"))
                setStroke(dp(if (selected) 2 else 1), Color.parseColor(if (selected) "#37E37B" else "#40FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(dp(52), dp(64)).apply {
                bottomMargin = dp(6)
            }
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
            clipToOutline = true
        }

        val image = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
                setColor(Color.parseColor("#111111"))
            }
            clipToOutline = true
            setImageResource(R.drawable.ic_yenkasa_logo)
        }
        if (!imageUrl.isNullOrBlank()) {
            Glide.with(context)
                .load(imageUrl)
                .placeholder(R.drawable.ic_yenkasa_logo)
                .error(R.drawable.ic_yenkasa_logo)
                .into(image)
        }

        val shade = View(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.TRANSPARENT, Color.parseColor("#D9000000"))
            )
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                dp(30),
                Gravity.BOTTOM
            )
        }

        val label = TextView(context).apply {
            text = title
            textSize = 8.5f
            setTextColor(Color.parseColor(if (selected) "#8DFFB8" else "#FFFFFFFF"))
            maxLines = 1
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            ).apply {
                leftMargin = dp(4)
                rightMargin = dp(4)
                bottomMargin = dp(6)
            }
        }

        val activeDot = TextView(context).apply {
            text = "✓"
            textSize = 8f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#20C863"))
            }
            visibility = if (selected) View.VISIBLE else View.GONE
            layoutParams = FrameLayout.LayoutParams(dp(12), dp(12), Gravity.TOP or Gravity.END).apply {
                topMargin = dp(3)
                rightMargin = dp(3)
            }
        }

        card.addView(image)
        card.addView(shade)
        card.addView(label)
        card.addView(activeDot)
        return card
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
