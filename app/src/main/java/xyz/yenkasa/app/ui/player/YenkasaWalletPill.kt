package xyz.yenkasa.app.ui.player

import android.content.Context
import android.util.AttributeSet
import android.view.Gravity
import android.widget.ImageView
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
        val pad = (12 * resources.displayMetrics.density).toInt()
        setPadding(pad, (8 * resources.displayMetrics.density).toInt(), pad, (8 * resources.displayMetrics.density).toInt())
        elevation = 10f

        val icon = ImageView(context).apply {
            setImageResource(R.drawable.ic_wallet)
            imageTintList = ContextCompat.getColorStateList(context, R.color.wallet_accent_gold)
            layoutParams = LayoutParams(dp(18), dp(18))
        }
        addView(icon)

        val textWrap = LinearLayout(context).apply {
            orientation = VERTICAL
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                marginStart = dp(8)
            }
        }

        balanceView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 14f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        subtextView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, R.color.wallet_accent_green))
            textSize = 11f
            text = "Wallet"
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
