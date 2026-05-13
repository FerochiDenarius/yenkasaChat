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

class YenkasaLiveStreamButton @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val pulseHandler = Handler(Looper.getMainLooper())
    private var pulseRunnable: Runnable? = null

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER
        background = ContextCompat.getDrawable(context, R.drawable.bg_livestream_button)
        val pad = dp(7)
        setPadding(pad, pad, pad, pad)
        elevation = 12f

        addView(ImageView(context).apply {
            setImageResource(R.drawable.ic_live_bolt)
            imageTintList = ContextCompat.getColorStateList(context, android.R.color.white)
            layoutParams = LayoutParams(dp(16), dp(16))
        })
        addView(TextView(context).apply {
            text = context.getString(R.string.live_caps)
            gravity = Gravity.CENTER
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 10f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
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
        if (visibility == VISIBLE && isAttachedToWindow) startPulse() else stopPulse()
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
                    .alpha(0.84f)
                    .scaleX(1.06f)
                    .scaleY(1.06f)
                    .setDuration(380L)
                    .withEndAction {
                        animate()
                            .alpha(1f)
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(460L)
                            .start()
                    }
                    .start()
                pulseHandler.postDelayed(this, 2400L)
            }
        }.also { pulseHandler.postDelayed(it, 500L) }
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
