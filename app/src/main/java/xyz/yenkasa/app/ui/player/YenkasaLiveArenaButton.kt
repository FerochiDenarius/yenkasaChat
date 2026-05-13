package xyz.yenkasa.app.ui.player

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.AttributeSet
import android.view.Gravity
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R

class YenkasaLiveArenaButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val pulseHandler = Handler(Looper.getMainLooper())
    private var pulseRunnable: Runnable? = null

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_player_live)
        val pad = dp(6)
        setPadding(pad, pad, pad, pad)
        elevation = 10f

        addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_live_bolt)
            imageTintList = ContextCompat.getColorStateList(context, R.color.wallet_accent_green)
            layoutParams = LayoutParams(dp(15), dp(15))
        })
        addView(TextView(context).apply {
            text = context.getString(R.string.arena)
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, R.color.white))
            textSize = 9f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
        addView(TextView(context).apply {
            text = context.getString(R.string.live_caps)
            gravity = Gravity.CENTER
            background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_live_badge)
            setTextColor(ContextCompat.getColor(context, R.color.white))
            textSize = 7f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            layoutParams = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply {
                topMargin = dp(3)
            }
        })
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startPulse()
    }

    override fun onDetachedFromWindow() {
        stopPulse()
        super.onDetachedFromWindow()
    }

    override fun onVisibilityChanged(changedView: View, visibility: Int) {
        super.onVisibilityChanged(changedView, visibility)
        if (visibility == VISIBLE && isAttachedToWindow) {
            startPulse()
        } else {
            stopPulse()
        }
    }

    private fun startPulse() {
        if (pulseRunnable != null || !isShown) return
        pulseRunnable = object : Runnable {
            override fun run() {
                if (!isShown || !isAttachedToWindow) {
                    stopPulse()
                    return
                }
                animate()
                    .alpha(0.86f)
                    .scaleX(1.035f)
                    .scaleY(1.035f)
                    .setDuration(420L)
                    .withEndAction {
                        animate()
                            .alpha(1f)
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(520L)
                            .start()
                    }
                    .start()
                pulseHandler.postDelayed(this, 3200L)
            }
        }.also { pulseHandler.postDelayed(it, 600L) }
    }

    private fun stopPulse() {
        pulseRunnable?.let { pulseHandler.removeCallbacks(it) }
        pulseRunnable = null
        animate().cancel()
        alpha = 1f
        scaleX = 1f
        scaleY = 1f
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
