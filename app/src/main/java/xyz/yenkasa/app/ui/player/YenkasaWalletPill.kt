package xyz.yenkasa.app.ui.player

import android.content.Context
import android.media.MediaPlayer
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
        setPadding(dp(7), dp(5), dp(8), dp(5))
        elevation = 10f

        val coin = TextView(context).apply {
            text = "YK"
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 9f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            background = ContextCompat.getDrawable(context, R.drawable.bg_feed_wallet_coin)
            layoutParams = LayoutParams(dp(26), dp(26))
        }
        addView(coin)

        val textWrap = LinearLayout(context).apply {
            orientation = VERTICAL
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                marginStart = dp(6)
            }
        }

        balanceView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 10f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            maxLines = 1
        }
        subtextView = TextView(context).apply {
            setTextColor(ContextCompat.getColor(context, R.color.wallet_accent_green))
            textSize = 8f
            text = "Wallet"
            maxLines = 1
        }
        textWrap.addView(balanceView)
        textWrap.addView(subtextView)
        addView(textWrap)
    }

    fun setBalance(balance: Double) {
        balanceView.text = "${NumberFormat.getNumberInstance(Locale.getDefault()).format(balance)}"
    }

    fun showRewardGain(balance: Double, rewardAmount: Int) {
        setBalance(balance)
        if (rewardAmount <= 0) return

        animate().cancel()
        subtextView.animate().cancel()
        subtextView.text = "+$rewardAmount YKC"
        scaleX = 1f
        scaleY = 1f
        alpha = 1f

        animate()
            .scaleX(1.08f)
            .scaleY(1.08f)
            .setDuration(150L)
            .withEndAction {
                animate().scaleX(1f).scaleY(1f).setDuration(180L).start()
            }
            .start()

        subtextView.alpha = 1f
        subtextView.translationY = 0f
        subtextView.animate()
            .translationY(-dp(8).toFloat())
            .alpha(0f)
            .setStartDelay(650L)
            .setDuration(650L)
            .withEndAction {
                subtextView.translationY = 0f
                subtextView.alpha = 1f
                subtextView.text = "Wallet"
            }
            .start()

        playRewardSound()
    }

    private fun playRewardSound() {
        val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("reward_notifications_enabled", true)) return
        val selectedSound = prefs.getString("notification_sound", "sound_default") ?: "sound_default"
        if (selectedSound == "sound_off") return

        val soundRes = context.resources.getIdentifier(selectedSound, "raw", context.packageName)
            .takeIf { it != 0 } ?: R.raw.sound_default
        runCatching {
            MediaPlayer.create(context.applicationContext, soundRes)?.apply {
                setOnCompletionListener { player -> player.release() }
                start()
            }
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
