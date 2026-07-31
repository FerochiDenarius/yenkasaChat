package xyz.yenkasa.app.util

import android.app.Activity
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.view.Window
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updateLayoutParams
import androidx.core.view.updatePadding
import kotlin.math.max

object EdgeToEdgeInsets {
    private data class InitialPadding(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int
    )

    private data class InitialMargins(
        val left: Int,
        val top: Int,
        val right: Int,
        val bottom: Int
    )

    fun setLightSystemBars(window: Window, lightStatusBars: Boolean, lightNavigationBars: Boolean) {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = lightStatusBars
            isAppearanceLightNavigationBars = lightNavigationBars
        }
    }

    fun enableEdgeToEdge(
        activity: ComponentActivity,
        lightStatusBars: Boolean,
        lightNavigationBars: Boolean
    ) {
        activity.enableEdgeToEdge(
            statusBarStyle = if (lightStatusBars) {
                SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
            } else {
                SystemBarStyle.dark(Color.TRANSPARENT)
            },
            navigationBarStyle = if (lightNavigationBars) {
                SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
            } else {
                SystemBarStyle.dark(Color.TRANSPARENT)
            }
        )
        setLightSystemBars(activity.window, lightStatusBars, lightNavigationBars)
    }

    fun hideSystemBars(window: Window) {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    fun showSystemBars(window: Window) {
        WindowInsetsControllerCompat(window, window.decorView).show(WindowInsetsCompat.Type.systemBars())
    }

    fun hideSystemBars(activity: Activity) {
        hideSystemBars(activity.window)
    }

    fun showSystemBars(activity: Activity) {
        showSystemBars(activity.window)
    }

    fun applySystemBarPadding(
        view: View,
        left: Boolean = false,
        top: Boolean = false,
        right: Boolean = false,
        bottom: Boolean = false
    ) {
        val initial = InitialPadding(
            view.paddingLeft,
            view.paddingTop,
            view.paddingRight,
            view.paddingBottom
        )

        ViewCompat.setOnApplyWindowInsetsListener(view) { target, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            target.updatePadding(
                left = initial.left + if (left) bars.left else 0,
                top = initial.top + if (top) bars.top else 0,
                right = initial.right + if (right) bars.right else 0,
                bottom = initial.bottom + if (bottom) bars.bottom else 0
            )
            insets
        }
        ViewCompat.requestApplyInsets(view)
    }

    fun applySystemBarMargins(
        view: View,
        left: Boolean = false,
        top: Boolean = false,
        right: Boolean = false,
        bottom: Boolean = false
    ) {
        val params = view.layoutParams as? ViewGroup.MarginLayoutParams
        val initial = InitialMargins(
            params?.leftMargin ?: 0,
            params?.topMargin ?: 0,
            params?.rightMargin ?: 0,
            params?.bottomMargin ?: 0
        )

        ViewCompat.setOnApplyWindowInsetsListener(view) { target, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            target.updateLayoutParams<ViewGroup.MarginLayoutParams> {
                leftMargin = initial.left + if (left) bars.left else 0
                topMargin = initial.top + if (top) bars.top else 0
                rightMargin = initial.right + if (right) bars.right else 0
                bottomMargin = initial.bottom + if (bottom) bars.bottom else 0
            }
            insets
        }
        ViewCompat.requestApplyInsets(view)
    }

    fun applyRecyclerBottomInset(recyclerView: View) {
        val initialBottom = recyclerView.paddingBottom
        ViewCompat.setOnApplyWindowInsetsListener(recyclerView) { target, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            target.updatePadding(bottom = initialBottom + bars.bottom)
            insets
        }
        ViewCompat.requestApplyInsets(recyclerView)
    }

    fun maxHorizontalInset(view: View, onChanged: (Int) -> Unit) {
        ViewCompat.setOnApplyWindowInsetsListener(view) { _, insets ->
            val bars = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            onChanged(max(bars.left, bars.right))
            insets
        }
        ViewCompat.requestApplyInsets(view)
    }
}
