package xyz.yenkasa.app.ui.player

import android.animation.ValueAnimator
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.AttributeSet
import android.view.Gravity
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import xyz.yenkasa.app.R

class YenkasaSearchBarView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : LinearLayout(context, attrs) {

    private val handler = Handler(Looper.getMainLooper())
    private var queryCallback: (String) -> Unit = {}
    private val collapsedWidth = dp(42)
    private val expandedWidth = dp(232)
    private var isExpanded = false

    private val searchInput = EditText(context).apply {
        background = null
        hint = context.getString(R.string.search_yenkasa)
        setHintTextColor(0x99FFFFFF.toInt())
        setTextColor(ContextCompat.getColor(context, android.R.color.white))
        textSize = 13f
        setSingleLine(true)
        alpha = 0f
        layoutParams = LayoutParams(0, LayoutParams.WRAP_CONTENT).apply {
            marginStart = dp(8)
            weight = 1f
        }
    }

    private val debounceRunnable = Runnable {
        val query = searchInput.text?.toString()?.trim().orEmpty()
        if (query.length >= 2) queryCallback(query)
    }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = ContextCompat.getDrawable(context, R.drawable.bg_yenkasa_search_bar)
        isClickable = true
        isFocusable = true
        isFocusableInTouchMode = true
        setPadding(dp(10), 0, dp(10), 0)

        val searchIcon = ImageView(context).apply {
            setImageResource(R.drawable.ic_search)
            setColorFilter(ContextCompat.getColor(context, android.R.color.white))
            layoutParams = LayoutParams(dp(18), dp(18))
            isClickable = true
            setOnClickListener { expandAndFocus() }
        }
        addView(searchIcon)
        addView(searchInput)

        setOnClickListener { expandAndFocus() }
        searchInput.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus && searchInput.text.isNullOrBlank()) collapse()
        }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                handler.removeCallbacks(debounceRunnable)
                handler.postDelayed(debounceRunnable, 320L)
            }
            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    fun setOnQueryChanged(callback: (String) -> Unit) {
        queryCallback = callback
    }

    fun collapseIfEmpty() {
        if (searchInput.text.isNullOrBlank()) collapse()
    }

    fun reset() {
        handler.removeCallbacks(debounceRunnable)
        searchInput.setText("")
        collapse()
    }

    fun expandAndFocus() {
        if (isExpanded) {
            searchInput.requestFocus()
            showKeyboard()
            return
        }
        isExpanded = true
        animateWidth(expandedWidth)
        searchInput.animate().alpha(1f).setDuration(140L).start()
        searchInput.requestFocus()
        showKeyboard()
    }

    private fun collapse() {
        isExpanded = false
        searchInput.animate().alpha(0f).setDuration(100L).start()
        animateWidth(collapsedWidth)
    }

    private fun showKeyboard() {
        post {
            val imm = context.getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
            imm.showSoftInput(searchInput, InputMethodManager.SHOW_IMPLICIT)
        }
    }

    private fun animateWidth(targetWidth: Int) {
        val currentWidth = width.takeIf { it > 0 } ?: collapsedWidth
        ValueAnimator.ofInt(currentWidth, targetWidth).apply {
            duration = 180L
            addUpdateListener { animator ->
                layoutParams = layoutParams.apply {
                    width = animator.animatedValue as Int
                }
            }
            start()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
