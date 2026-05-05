package xyz.yenkasa.app.ui.player

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
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
    ): View {
        val card = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(16).toFloat()
                setColor(Color.parseColor("#101112"))
                setStroke(dp(1), Color.parseColor(if (selected) "#37E37B" else "#40FFFFFF"))
            }
            layoutParams = LinearLayout.LayoutParams(dp(86), dp(88)).apply {
                marginEnd = dp(7)
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
                cornerRadius = dp(16).toFloat()
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
                dp(42),
                Gravity.BOTTOM
            )
        }

        val label = TextView(context).apply {
            text = title
            textSize = 12f
            setTextColor(Color.WHITE)
            maxLines = 1
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM
            ).apply {
                leftMargin = dp(8)
                rightMargin = dp(8)
                bottomMargin = dp(9)
            }
        }

        card.addView(image)
        card.addView(shade)
        card.addView(label)
        return card
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
