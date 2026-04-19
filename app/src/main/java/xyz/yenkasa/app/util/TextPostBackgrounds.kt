package xyz.yenkasa.app.util

import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.widget.TextView

object TextPostBackgrounds {
    val options = listOf(
        "",
        "#FDD835",
        "#00A884",
        "#1D4ED8",
        "#DB2777",
        "#7C3AED",
        "#DC2626",
        "#111827"
    )

    fun normalize(color: String?): String {
        val trimmed = color?.trim().orEmpty()
        return if (trimmed.matches(Regex("^#[0-9A-Fa-f]{6}$"))) trimmed.uppercase() else ""
    }

    fun apply(textView: TextView, color: String, centered: Boolean = true) {
        val normalized = normalize(color)
        val radius = 8f * textView.resources.displayMetrics.density
        val backgroundColor = Color.parseColor(normalized)

        textView.background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(backgroundColor)
        }
        textView.setTextColor(textColorFor(backgroundColor))
        textView.setTypeface(textView.typeface, Typeface.BOLD)
        if (centered) {
            textView.gravity = Gravity.CENTER
        }
    }

    fun swatchDrawable(color: String, selected: Boolean, density: Float): GradientDrawable {
        val normalized = normalize(color)
        val fill = if (normalized.isBlank()) Color.WHITE else Color.parseColor(normalized)
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 8f * density
            setColor(fill)
            setStroke(
                if (selected) (3f * density).toInt() else (1f * density).toInt(),
                if (selected) Color.BLACK else Color.LTGRAY
            )
        }
    }

    private fun textColorFor(backgroundColor: Int): Int {
        val red = Color.red(backgroundColor)
        val green = Color.green(backgroundColor)
        val blue = Color.blue(backgroundColor)
        val luminance = (0.299 * red + 0.587 * green + 0.114 * blue)
        return if (luminance > 150) Color.BLACK else Color.WHITE
    }
}
