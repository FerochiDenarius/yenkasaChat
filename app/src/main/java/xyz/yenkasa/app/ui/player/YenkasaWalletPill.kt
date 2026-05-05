package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R
import java.text.NumberFormat
import java.util.Locale

class YenkasaWalletPill @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val balanceView: TextView
    private val subtextView: TextView

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_player_pill)
        setPadding(dp(12), dp(8), dp(12), dp(8))
        elevation = 10f

        val coin = TextView(context).apply {
            text = "YK"
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 11f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            background = ContextCompat.getDrawable(context, R.drawable.bg_feed_wallet_coin)
            layoutParams = LayoutParams(dp(34), dp(34))
        }
        addView(coin)

        val textWrap = LinearLayout(context).apply {
            orientation = VERTICAL
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                marginStart = dp(10)
            }
        }

        balanceView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 13f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        subtextView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, R.color.wallet_accent_green))
            textSize = 10f
            text = "~ $48.12 USD"
        }
        textWrap.addView(balanceView)
        textWrap.addView(subtextView)
        addView(textWrap)
    }

    fun setBalance(balance: Double) {
        balanceView.text = "${NumberFormat.getNumberInstance(Locale.getDefault()).format(balance)} YKC"
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
