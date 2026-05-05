package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R

class YenkasaSponsoredAdButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_player_glass)
        setPadding(dp(10), dp(7), dp(10), dp(7))
        elevation = 10f

        addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_ads_plus)
            imageTintList = ContextCompat.getColorStateList(context, R.color.feed_action_icon)
            layoutParams = LayoutParams(dp(15), dp(15))
        })

        addView(TextView(context).apply {
            text = "Create Sponsored Ad"
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 11f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                marginStart = dp(8)
            }
        })
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
