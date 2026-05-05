package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R

class YenkasaLiveArenaButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_player_live)
        val pad = dp(18)
        setPadding(pad, pad, pad, pad)
        elevation = 12f

        addView(TextView(context).apply {
            text = "YENKASA\nLIVE ARENA"
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, R.color.white))
            textSize = 14f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        addView(TextView(context).apply {
            text = "Join Now"
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, R.color.wallet_accent_green))
            textSize = 12f
        })
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
