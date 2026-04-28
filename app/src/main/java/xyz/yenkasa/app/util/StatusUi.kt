package xyz.yenkasa.app.util

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.widget.TextView

object StatusUi {
    fun getStatusColor(status: String): Int {
        return when (status.trim().lowercase()) {
            "pending" -> Color.parseColor("#EAB308")
            "approved" -> Color.parseColor("#16A34A")
            "rejected" -> Color.parseColor("#DC2626")
            else -> Color.parseColor("#6B7280")
        }
    }

    fun applyBadge(textView: TextView, status: String?) {
        val safeStatus = status?.trim()?.lowercase().orEmpty().ifBlank { "unknown" }
        textView.text = safeStatus.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
        textView.setTextColor(Color.WHITE)
        textView.background = badgeDrawable(textView.context, safeStatus)
    }

    private fun badgeDrawable(context: Context, status: String): GradientDrawable {
        return GradientDrawable().apply {
            cornerRadius = 999f
            setColor(getStatusColor(status))
            setStroke(dp(context, 1), withAlpha(getStatusColor(status), 0.85f))
        }
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private fun withAlpha(color: Int, alphaFraction: Float): Int {
        val alpha = (255 * alphaFraction).toInt().coerceIn(0, 255)
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))
    }
}
