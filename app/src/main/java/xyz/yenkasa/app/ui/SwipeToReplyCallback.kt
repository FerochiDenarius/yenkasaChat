package xyz.yenkasa.app.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.RecyclerView
import xyz.yenkasa.app.R

class SwipeToReplyCallback(
    context: Context,
    private val onSwiped: (RecyclerView.ViewHolder) -> Unit
) : ItemTouchHelper.SimpleCallback(0, ItemTouchHelper.LEFT) {

    private val replyIcon = ContextCompat.getDrawable(context, R.drawable.ic_reply)
    private val background = ColorDrawable(Color.LTGRAY)
    private val maxSwipeDistance = context.resources.displayMetrics.density * 96

    override fun onMove(
        recyclerView: RecyclerView,
        viewHolder: RecyclerView.ViewHolder,
        target: RecyclerView.ViewHolder
    ): Boolean {
        return false // We don't want to handle move events, so we return false
    }

    override fun onSwiped(viewHolder: RecyclerView.ViewHolder, direction: Int) {
        onSwiped(viewHolder)
    }

    override fun getSwipeThreshold(viewHolder: RecyclerView.ViewHolder): Float {
        return 0.25f
    }

    override fun getSwipeEscapeVelocity(defaultValue: Float): Float {
        return defaultValue * 8
    }

    override fun clearView(recyclerView: RecyclerView, viewHolder: RecyclerView.ViewHolder) {
        super.clearView(recyclerView, viewHolder)
        viewHolder.itemView.translationX = 0f
        background.setBounds(0, 0, 0, 0)
        replyIcon?.setBounds(0, 0, 0, 0)
    }

    override fun onChildDraw(
        c: Canvas,
        recyclerView: RecyclerView,
        viewHolder: RecyclerView.ViewHolder,
        dX: Float,
        dY: Float,
        actionState: Int,
        isCurrentlyActive: Boolean
    ) {
        val itemView = viewHolder.itemView
        val clampedDx = dX.coerceIn(-maxSwipeDistance, 0f)
        val iconMargin = (itemView.height - (replyIcon?.intrinsicHeight ?: 0)) / 2
        val iconTop = itemView.top + iconMargin
        val iconBottom = iconTop + (replyIcon?.intrinsicHeight ?: 0)

        // Swiping to the left
        if (clampedDx < 0) {
            val iconRight = itemView.right - iconMargin
            val iconLeft = iconRight - (replyIcon?.intrinsicWidth ?: 0)
            replyIcon?.setBounds(iconLeft, iconTop, iconRight, iconBottom)

            background.setBounds(
                itemView.right + clampedDx.toInt(),
                itemView.top,
                itemView.right,
                itemView.bottom
            )
        } else { // view is unSwiped
            background.setBounds(0, 0, 0, 0)
        }

        background.draw(c)
        replyIcon?.draw(c)
        super.onChildDraw(c, recyclerView, viewHolder, clampedDx, dY, actionState, isCurrentlyActive)
    }
}
